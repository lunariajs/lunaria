import { resolve } from 'node:path';
import { type ConsolaInstance, createConsola } from 'consola';
import pAll from 'p-all';
import picomatch from 'picomatch';
import { glob } from 'tinyglobby';
import { loadConfig, validateInitialConfig } from './config/config.js';
import type { LunariaConfig, Pattern } from './config/types.js';
import { CONSOLE_LEVELS } from './constants.js';
import { FilesEntryNotFound, SourceFileNotFound } from './errors/errors.js';
import { createPathResolver } from './files/paths.js';
import { runSetupHook } from './integrations/integrations.js';
import { LunariaGitInstance } from './status/git.js';
import { getDictionaryCompletion, isFileLocalizable } from './status/status.js';
import type { LunariaStatus, StatusLocalizationEntry } from './status/types.js';
import type { LunariaOpts } from './types.js';
import {
	createCache,
	createGitHostingLinks,
	exists,
	externalSafePath,
	md5,
} from './utils/utils.js';

export type { LunariaIntegration } from './integrations/types.js';
export type * from './files/types.js';
export type * from './status/types.js';
export type * from './config/types.js';

class Lunaria {
	readonly config: LunariaConfig;
	#git: LunariaGitInstance;
	#logger: ConsolaInstance;
	#force: boolean;
	#hash: string;
	#cwd: string;

	constructor(
		config: LunariaConfig,
		git: LunariaGitInstance,
		logger: ConsolaInstance,
		hash: string,
		cwd: string,
		force = false,
	) {
		this.config = config;
		this.#git = git;
		this.#logger = logger;
		this.#force = force;
		// Hash used to revalidate the cache -- the tracking properties manipulate how the changes are tracked,
		// therefore we have to account for them so that the cache is fresh.
		this.#hash = hash;
		this.#cwd = cwd;
	}

	/** Returns an array of the source path of all tracked files. */
	async getSourcePaths() {
		const { files } = this.config;

		const sourcePaths: string[] = [];

		for (const file of files) {
			const { include, exclude, pattern } = file;

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
			for (const entry of sortedPaths) {
				sourcePaths.push(entry);
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
					const entry = await this.getFileStatus(path);
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
			await cache.write(this.#git.cache);
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

	async #getFileStatus(path: string, cache: boolean) {
		const { external } = this.config;

		const file = this.findFilesEntry(path);

		if (!file) {
			this.#logger.error(FilesEntryNotFound.message(path));
			return undefined;
		}

		const { isSourcePath, toPath } = this.getPathResolver(file.pattern);

		/** The given path can be of another locale, therefore we always convert it to the source path */
		const sourcePath = isSourcePath(path) ? path : toPath(path, this.config.sourceLocale.lang);

		if (!(await exists(externalSafePath(external, this.#cwd, sourcePath)))) {
			this.#logger.error(SourceFileNotFound.message(sourcePath, path));
			return undefined;
		}

		const isLocalizable = await isFileLocalizable(
			externalSafePath(external, this.#cwd, sourcePath),
			this.config.tracking.localizableProperty,
		);

		if (isLocalizable instanceof Error) {
			this.#logger.error(isLocalizable.message);
			return undefined;
		}

		// If the file isn't localizable, we don't need to track it.
		if (!isLocalizable) {
			this.#logger.debug(
				`The file \`${path}\` is being tracked but is not localizable. Frontmatter property \`${this.config.tracking.localizableProperty}\` needs to be \`true\` to get a status for this file.`,
			);
			return undefined;
		}

		const latestSourceChanges = await this.#git.getFileLatestChanges(sourcePath);

		// Save the existing git data into the cache for next builds.
		if (cache) {
			const cache = await createCache(this.config.cacheDir, 'git', this.#hash);
			await cache.write(this.#git.cache);
		}

		const localizations: StatusLocalizationEntry[] = new Array(this.config.locales.length);

		const tasks = this.config.locales.map(({ lang }) => {
			return async () => {
				{
					const localizedPath = toPath(sourcePath, lang);

					if (!(await exists(resolve(externalSafePath(external, this.#cwd, localizedPath))))) {
						localizations.push({
							lang: lang,
							path: localizedPath,
							status: 'missing',
						});
						return;
					}

					const latestLocaleChanges = await this.#git.getFileLatestChanges(localizedPath);

					/**
					 * Outdatedness is defined when the latest tracked (that is, considered by Lunaria)
					 * change in the source file is newer than the latest tracked change in the localized file.
					 */
					const isOutdated =
						new Date(latestSourceChanges.latestTrackedChange.date) >
						new Date(latestLocaleChanges.latestTrackedChange.date);

					const entryTypeData = async () => {
						if (file.type === 'dictionary') {
							try {
								const missingKeys = await getDictionaryCompletion(
									file.optionalKeys,
									externalSafePath(external, this.#cwd, sourcePath),
									externalSafePath(external, this.#cwd, localizedPath),
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
						lang: lang,
						path: localizedPath,
						git: latestLocaleChanges,
						status: isOutdated ? 'outdated' : 'up-to-date',
						...(await entryTypeData()),
					});
				}
			};
		});

		await pAll(tasks, { concurrency: 5 });

		return {
			...file,
			source: {
				lang: this.config.sourceLocale.lang,
				path: sourcePath,
				git: latestSourceChanges,
			},
			localizations,
		};
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

		const git = new LunariaGitInstance(config, logger, cache, opts?.force);

		let cwd = process.cwd();

		if (config.external) {
			cwd = await git.handleExternalRepository();
		}

		return new Lunaria(config, git, logger, hash, cwd, opts?.force);
	} catch (e) {
		if (e instanceof Error) logger.error(e.message);
		process.exit(1);
	}
}
