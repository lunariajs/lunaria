import { join, resolve } from 'node:path';
import { type ConsolaInstance, createConsola } from 'consola';
import pAll from 'p-all';
import picomatch from 'picomatch';
import { glob } from 'tinyglobby';
import { loadConfig, validateInitialConfig } from './config/config.ts';
import type { LunariaConfig, Pattern } from './config/types.ts';
import { CONSOLE_LEVELS } from './constants.ts';
import { FilesEntryNotFound, FileNotFound } from './errors/errors.ts';
import { createPathResolver } from './files/paths.ts';
import { runSetupHook } from './integrations/integrations.ts';
import { LunariaGitInstance } from './status/git.ts';
import { getMissingDictionaryKeys } from './status/status.ts';
import type { LunariaStatus, StatusLocalizationEntry } from './status/types.ts';
import type { LunariaOpts } from './types.ts';
import { createCache, createGitHostingLinks, exists, md5 } from './utils/utils.ts';
import { readFile } from 'node:fs/promises';
import { parse } from 'ultramatter';

export type { LunariaIntegration } from './integrations/types.ts';
export type * from './files/types.ts';
export type * from './status/types.ts';
export type * from './config/types.ts';

class Lunaria {
	readonly config: LunariaConfig;
	git: LunariaGitInstance;
	#logger: ConsolaInstance;
	#force: boolean;
	#hash: string;
	#cwd: string;
	#cache: Record<string, string>;

	constructor(
		config: LunariaConfig,
		git: LunariaGitInstance,
		logger: ConsolaInstance,
		hash: string,
		cwd: string,
		cache: Record<string, string>,
		force = false,
	) {
		this.config = config;
		this.git = git;
		this.#logger = logger;
		this.#force = force;
		// Hash used to revalidate the cache -- the tracking properties manipulate how the changes are tracked,
		// therefore we have to account for them so that the cache is fresh.
		this.#hash = hash;
		this.#cwd = cwd;
		this.#cache = cache;
	}

	/** Returns an array of the source path of all tracked files. */
	async getSourcePaths() {
		const { files } = this.config;

		const sourcePaths: string[] = [];

		for (const entry of files) {
			const { include, exclude, pattern } = entry;

			this.#logger.debug(
				`Processing files with pattern: ${
					typeof pattern === 'string'
						? pattern
						: `${pattern.source} (source) - ${pattern.locales} (locales)`
				}`,
			);

			// Paths that were filtered out by not matching the source pattern.
			// We keep track of those to warn the user about them.
			const filteredOutPaths: string[] = [];

			const { isSourcePath } = this.getPathResolver(pattern);

			const globbedPaths = (
				await glob(include, {
					expandDirectories: false,
					ignore: exclude,
					cwd: this.#cwd,
				})
			).filter((path) => {
				if (!isSourcePath(path)) {
					filteredOutPaths.push(path);
					return false;
				}
				return true;
			});

			if (filteredOutPaths.length > 0) {
				this.#logger.warn(
					`The following paths were filtered out by not matching the source pattern: ${filteredOutPaths.map(
						(path) => `\n- ${path}`,
					)}\n\nVerify if your \`files\`'s \`pattern\`, \`include\`, and \`exclude\` are correctly set.`,
				);
			}

			const sortedPaths = globbedPaths.sort((a, b) => a.localeCompare(b));
			for (const path of sortedPaths) {
				sourcePaths.push(path);
			}
		}

		return sourcePaths;
	}

	async getFullStatus() {
		const sourcePaths = await this.getSourcePaths();
		const status: LunariaStatus = [];

		await pAll(
			sourcePaths.map((path) => {
				return async () => {
					const entry = await this.#getFileStatus(path, false);
					if (entry) status.push(entry);
				};
			}),
			{
				concurrency: 10,
			},
		);

		// Save the existing git data into the cache for next builds.
		if (!this.#force) {
			const cache = await createCache(this.config.cacheDir, 'git', this.#hash);
			await cache.write(this.#cache);
		}

		return status;
	}

	// The existence of both a public and private `getFileStatus()` is to hide
	// the cache parameter from the public API. We do that so when we invoke
	// it from `getFullStatus()` we only write to the cache once, considerably
	// increasing performance (1 cache write instead of one for each file).
	// Otherwise, when users invoke this method, they will also want to enjoy
	// caching normally, unless they explicitly want to force a fresh status.
	async getFileStatus(path: string) {
		return this.#getFileStatus(path, !this.#force);
	}

	/** Returns a path resolver for the specified pattern. */
	getPathResolver(pattern: Pattern) {
		return createPathResolver(pattern, this.config.sourceLocale, this.config.locales);
	}

	/** Finds the matching `files` entry for the specified path. */
	findFilesEntry(path: string) {
		return this.config.files.find((file) => {
			const { isSourcePath, isLocalesPath, toPath } = this.getPathResolver(file.pattern);

			// To certify an entry matches fully, we have to first check if the path does match the existing
			// pattern for that entry, then we convert the path to the source path and check if it matches
			// against `include` and `exclude` properties. Otherwise, patterns could be matched incorrectly
			// by matching only partially.
			try {
				if (!isSourcePath(path) && !isLocalesPath(path)) return false;

				const sourcePath = isSourcePath(path) ? path : toPath(path, this.config.sourceLocale.lang);
				return picomatch.isMatch(sourcePath, file.include, {
					ignore: file.exclude,
				});
			} catch {
				// If it fails to match, we assume it's not the respective `files` config and return false.
				return false;
			}
		});
	}

	gitHostingLinks() {
		return createGitHostingLinks(this.config.repository);
	}

	/** Gets a file system path compatible with `external: true` repositories. */
	#getFsPath(path: string) {
		if (this.config.external) {
			return join(this.#cwd, path);
		}
		return path;
	}

	#isFileLocalizable(path: string, contents: string) {
		// If the file doesn't support frontmatter, it's automatically considered to be localizable.
		if (!/\.(md|markdown|mdx|mdoc)$/.test(path)) return true;

		const localizableProperty = this.config.tracking.localizableProperty;
		// If no localizableProperty is specified, all files are supposed to be localizable.
		if (!localizableProperty) return true;

		const frontmatter = parse(contents).frontmatter;
		const isLocalizable = frontmatter?.[localizableProperty];

		// If the property is not defined in the frontmatter, we assume the file is not localizable.
		if (typeof isLocalizable === 'undefined') return false;
		// If the type of the property is not a boolean, we assume the file is not localizable.
		if (typeof isLocalizable !== 'boolean') return false;

		return isLocalizable;
	}

	async #getFileData(path: string, lang: string) {
		const { sourceLocale } = this.config;
		const fsPath = this.#getFsPath(path);

		// In case a source path is passed, we error out if the file doesn't exist
		// since otherwise there's no way any status can be made out of it.
		if (!(await exists(fsPath))) {
			if (lang === sourceLocale.lang) this.#logger.error(FileNotFound.message(path));
			return undefined;
		}

		const contents = await readFile(fsPath, 'utf-8');
		// We only check if the source file is localizable, all other locales are automatically considered localizable.
		const isLocalizable =
			lang === sourceLocale.lang ? this.#isFileLocalizable(path, contents) : true;

		if (!isLocalizable) {
			this.#logger.debug(
				`The file \`${path}\` is being tracked but is not localizable. The frontmatter property \`${this.config.tracking.localizableProperty}\` needs to be \`true\` to get a status for this file.`,
			);
			return undefined;
		}

		const git = await this.git.getFileLatestCommits(path);

		return { path, contents, lang, git };
	}

	async #getFileStatus(path: string, cache: boolean) {
		const entry = this.findFilesEntry(path);

		if (!entry) {
			this.#logger.error(FilesEntryNotFound.message(path));
			return undefined;
		}

		// The method accepts a path for either the source or another locale's path,
		// therefore we have to make sure to convert the `path` to the source locale's `path`.
		const { isSourcePath, toPath } = this.getPathResolver(entry.pattern);
		const sourcePath = isSourcePath(path) ? path : toPath(path, this.config.sourceLocale.lang);

		const sourceFileData = await this.#getFileData(sourcePath, this.config.sourceLocale.lang);
		if (!sourceFileData) return undefined;

		// Save the existing git data into the cache for next builds.
		if (cache) {
			const cache = await createCache(this.config.cacheDir, 'git', this.#hash);
			await cache.write(this.#cache);
		}

		const localizations: StatusLocalizationEntry[] = [];

		const tasks = this.config.locales.map(({ lang }) => {
			return async () => {
				{
					const localePath = toPath(sourcePath, lang);
					const localeFileData = await this.#getFileData(localePath, lang);

					if (!localeFileData) {
						localizations.push({
							lang: lang,
							path: localePath,
							status: 'missing',
						});
						return;
					}

					// Outdatedness is defined when the latest tracked (that is, considered by Lunaria)
					// commit in the source file is newer than the latest tracked commit in the localized file.
					const isOutdated =
						sourceFileData.git.latestTrackedCommit.date >
						localeFileData.git.latestTrackedCommit.date;

					const entryTypeData = async () => {
						if (entry.type === 'dictionary') {
							try {
								const missingKeys = await getMissingDictionaryKeys(
									{
										fsPath: this.#getFsPath(sourceFileData.path),
										contents: sourceFileData.contents,
									},
									{
										fsPath: this.#getFsPath(localeFileData.path),
										contents: localeFileData.contents,
									},
									entry.optionalKeys,
								);

								return {
									missingKeys,
								};
							} catch (e) {
								if (e instanceof Error) {
									this.#logger.error(e.message);
								}
								process.exit(1);
							}
						}
						return {};
					};

					localizations.push({
						...localeFileData,
						status: isOutdated ? 'outdated' : 'up-to-date',
						...(await entryTypeData()),
					});
				}
			};
		});

		await pAll(tasks, { concurrency: 5 });

		return {
			...entry,
			source: {
				...sourceFileData,
			},
			localizations,
		};
	}
}

export async function createLunaria(opts?: LunariaOpts) {
	const logger = createConsola({
		level: CONSOLE_LEVELS[opts?.logLevel ?? 'info'],
	});

	try {
		const initialConfig = opts?.config ? validateInitialConfig(opts.config) : await loadConfig();
		const config = await runSetupHook(initialConfig, logger);

		const hash = md5(
			`ignoredKeywords::${config.tracking.ignoredKeywords.join(
				'|',
			)}:localizableProperty::${config.tracking.localizableProperty}`,
		);

		const cache = opts?.force
			? {}
			: await (await createCache(config.cacheDir, 'git', hash)).contents();

		const lunariaGit = new LunariaGitInstance(config, logger, cache, opts?.force);

		// TODO: Refactor this so its easier to add new platforms later.
		// Netlify does a blobless clone, meaning we have to fetch the blobs to ensure it can access all files.
		if (process.env.NETLIFY) {
			logger.info('Netlify deployment detected. Missing blobs will be fetched.');
			await lunariaGit.simpleGit.fetch(['--refetch', '--no-filter']);
		}

		if (process.env.VERCEL) {
			logger.info('Vercel deployment detected. Missing blobs will be fetched.');
			await lunariaGit.simpleGit.fetch(['--refetch', '--no-filter']);
		}

		const cwd = config.external
			? await handleExternalRepository(config, logger, git)
			: process.cwd();

		return new Lunaria(config, lunariaGit, logger, hash, cwd, cache, opts?.force);
	} catch (e) {
		if (e instanceof Error) logger.error(e.message);
		process.exit(1);
	}
}

// TODO: Using an external repo seems to introduce some sort of performance gains, this should be tested to ensure
// its not a bug e.g. not being able to read certain files or the git history not being complete and missing commits
// that are necessary for the status to be accurate.
async function handleExternalRepository(
	config: LunariaConfig,
	logger: ConsolaInstance,
	git: LunariaGitInstance,
) {
	const { cloneDir, repository } = config;
	const { name, hosting, rootDir } = repository;

	// The name can contain a slash, which is not allowed in a directory name.
	const safeName = name.replace('/', '-');
	const clonePath = resolve(cloneDir, safeName);

	// We need to prepend the root directory so it works in monorepos.
	// TODO: Test if this causes any issues in non-monorepo contexts.
	const monorepoSafePath = join(clonePath, rootDir);

	// The external repository has to be a full clone since we need the source contents for features like using `localizableProperty`.
	if (!(await exists(clonePath))) {
		// TODO: Implement a way to support private repositories.
		logger.start("External repository is enabled. Cloning repository's contents...");
		await git.simpleGit.clone(`https://${hosting}.com/${name}.git`, clonePath);
		// We need to change the working directory to the cloned repository, so all git commands are executed in the correct context.
		await git.simpleGit.cwd(monorepoSafePath);
	} else {
		await git.simpleGit.cwd(monorepoSafePath);
		await git.simpleGit.pull();
	}

	return monorepoSafePath;
}
