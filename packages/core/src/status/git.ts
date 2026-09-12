import { cpus } from 'node:os';
import type { ConsolaInstance } from 'consola';
import picomatch from 'picomatch';
import { simpleGit } from 'simple-git';
import type { LunariaConfig } from '../config/types.ts';
import { UncommittedFileFound } from '../errors/errors.ts';
import type { RegExpGroups } from '../utils/types.ts';
import type { Commit } from './types.ts';

export class LunariaGitInstance {
	simpleGit = simpleGit({
		maxConcurrentProcesses: Math.max(2, Math.min(32, cpus().length)),
	});
	#config: LunariaConfig;
	#logger: ConsolaInstance;
	#force: boolean;
	#cache: Record<string, string>;

	constructor(
		config: LunariaConfig,
		logger: ConsolaInstance,
		cache: Record<string, string>,
		force = false,
	) {
		this.#logger = logger;
		this.#config = config;
		this.#force = force;
		this.#cache = cache;
	}

	async getFileCommits(path: string, from?: string, to?: string): Promise<Commit[]> {
		const commits = await this.simpleGit.log({
			file: path,
			strictDate: true,
			from,
			to,
		});

		return commits.all.map((commit) => ({
			author: {
				name: commit.author_name,
				email: commit.author_email,
			},
			message: commit.message,
			body: commit.body,
			date: new Date(commit.date),
			hash: commit.hash,
			refs: commit.refs,
		}));
	}

	async getFileLatestCommits(path: string) {
		// The cache will keep the latest tracked commit hash, which means it will be able
		// to completely skip looking into older commits, considerably increasing performance.
		const fromCommit = this.#cache[path] ? `${this.#cache[path]}^` : undefined;
		const commits = fromCommit
			? await this.getFileCommits(path, fromCommit).catch(() =>
					// The cached commit might be the repository's root commit, or it might no longer
					// exist locally after a history rewrite. In those cases, fall back to a full history.
					this.getFileCommits(path),
				)
			: await this.getFileCommits(path);

		const latestCommit = commits[0];

		// Edge case: sometimes all the changes for a file (or the only one)
		// have been purposefully ignored in Lunaria, therefore we need to
		// define the latest change as the latest tracked change.
		const latestTrackedCommit =
			findLatestTrackedCommit(this.#config.tracking, path, commits) ?? latestCommit;

		if (!latestCommit || !latestTrackedCommit) {
			this.#logger.error(UncommittedFileFound.message(path));
			process.exit(1);
		}
		if (!this.#force) this.#cache[path] = latestTrackedCommit.hash;

		return { latestCommit, latestTrackedCommit };
	}
}

/**
 * Finds the latest tracked commit in a list of commits, tracked means
 * the latest commit that wasn't ignored from Lunaria's tracking system,
 * either by the use of a tracker directive or the inclusion of a ignored
 * keyword in the commit's name.
 */
export function findLatestTrackedCommit(
	tracking: LunariaConfig['tracking'],
	path: string,
	commits: Commit[],
) {
	/** Regex that matches a `'@lunaria-track'` or `'@lunaria-ignore'` group
	 * and a sequence of paths separated by semicolons till a line break.
	 *
	 * This means whenever a valid tracker directive is found, the tracking system
	 * lets the user take over and cherry-pick which files' changes should be tracked
	 * or ignored.
	 */
	const trackerDirectivesRe =
		/(?<directive>@lunaria-track|@lunaria-ignore):(?<pathsOrGlobs>[^\n]+)?/;

	/** Regex that matches any configured ignored keywords in the user's Lunaria config. */
	const ignoredKeywordsRe =
		tracking.ignoredKeywords.length > 0
			? new RegExp(`(${tracking.ignoredKeywords.join('|')})`, 'i')
			: undefined;

	return commits.find((commit) => {
		// Ignored keywords take precedence over tracker directives.
		if (ignoredKeywordsRe && commit.message.match(ignoredKeywordsRe)) return false;

		const trackerDirectiveMatch: RegExpGroups<'directive' | 'pathsOrGlobs'> =
			commit.body.match(trackerDirectivesRe);

		// If no tracker directive is found, we consider the commit as tracked.
		if (!trackerDirectiveMatch || !trackerDirectiveMatch.groups) return true;

		const { directive, pathsOrGlobs } = trackerDirectiveMatch.groups;

		const foundPath = pathsOrGlobs
			.split(';')
			// We filter here to avoid empty strings if an extra semicolon is added at the end.
			.filter((val) => val.length > 0)
			.find((pathOrGlob) => {
				// We trim here since there might be added extra spaces by accident.
				if (directive === '@lunaria-track') return picomatch.isMatch(path, pathOrGlob.trim());
				if (directive === '@lunaria-ignore') return picomatch.isMatch(path, pathOrGlob.trim());
				return false;
			});

		// If we find the path and it's a `track` directive, we consider the commit as the latest tracked.
		// Otherwise, we consider the commit as ignored.
		if (foundPath) return directive === '@lunaria-track';

		// If we don't find the path (undefined), for a `track` directive, we consider the commit as ignored, and for `ignore` as tracked.
		return directive === '@lunaria-ignore';
	});
}
