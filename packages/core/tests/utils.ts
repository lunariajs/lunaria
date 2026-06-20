import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CompleteLunariaUserConfig } from '../src/integrations/types.ts';
import type { LunariaStatus } from '../src/status/types.ts';

interface FileTree {
	[name: string]: string | FileTree;
}

export const sampleValidConfig: CompleteLunariaUserConfig = {
	repository: {
		name: 'yanthomasdev/lunaria',
	},
	sourceLocale: {
		label: 'English',
		lang: 'en',
	},
	locales: [
		{
			label: 'Spanish',
			lang: 'es',
		},
	],
	files: [
		{
			include: ['src/content/**/*.mdx'],
			pattern: 'src/content/@lang/@path',
			type: 'universal',
		},
	],
};

export function makeTestRepo(onPath?: string) {
	const repoPath = realpathSync(onPath ?? mkdtempSync(join(tmpdir(), 'lunaria-test-git-')));
	const shouldCleanup = !onPath;

	function runInRepo(command: string, args: string[], env: NodeJS.ProcessEnv = {}) {
		const result = spawnSync(command, args, {
			cwd: repoPath,
			env: { ...process.env, ...env },
			encoding: 'utf8',
		});

		if (result.status !== 0) {
			throw new Error(
				[
					`Failed to execute test repository command: '${command} ${args.join(' ')}'`,
					result.stdout,
					result.stderr,
					result.error?.message,
				]
					.filter(Boolean)
					.join('\n'),
			);
		}

		return result.stdout;
	}

	// Configure git specifically for this test repository.
	runInRepo('git', ['init']);
	runInRepo('git', ['config', 'user.name', 'lunaria-test']);
	runInRepo('git', ['config', 'user.email', 'lunaria-test@example.com']);
	runInRepo('git', ['config', 'commit.gpgsign', 'false']);

	return {
		runInRepo,
		// The `dateStr` argument should be in the `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ` format.
		commitAllChanges(message: string, dateStr: string, body?: string) {
			const date = dateStr.endsWith('Z') ? dateStr : `${dateStr}T00:00:00Z`;

			runInRepo('git', ['add', '-A']);
			// This sets both the author and committer dates to the provided date.
			runInRepo('git', ['commit', '-m', message, ...(body ? ['-m', body] : []), '--date', date], {
				GIT_COMMITTER_DATE: date,
			});

			return runInRepo('git', ['rev-parse', 'HEAD']).trim();
		},
		cleanup() {
			if (shouldCleanup) rmSync(repoPath, { recursive: true, force: true });
		},
		getRepoPath() {
			return repoPath;
		},
		getFilePath(name: string) {
			return join(repoPath, name);
		},
		writeFile(name: string, content: string) {
			const filePath = join(repoPath, name);
			mkdirSync(dirname(filePath), { recursive: true });
			writeFileSync(filePath, content);
		},
		writeFileTree(fileTree: FileTree) {
			const directories = [{ root: repoPath, fileTree }];

			for (const directory of directories) {
				for (const [name, entry] of Object.entries(directory.fileTree)) {
					const path = join(directory.root, name);

					if (typeof entry === 'string') {
						mkdirSync(dirname(path), { recursive: true });
						writeFileSync(path, entry);
					} else {
						mkdirSync(path, { recursive: true });
						directories.push({ root: path, fileTree: entry });
					}
				}
			}
		},
	};
}

export async function withTestRepo<T>(
	callback: (repo: ReturnType<typeof makeTestRepo>) => T | Promise<T>,
) {
	const previousCwd = process.cwd();
	const repo = makeTestRepo();

	process.chdir(repo.getRepoPath());

	try {
		return await callback(repo);
	} finally {
		process.chdir(previousCwd);
		repo.cleanup();
	}
}

export function getLocalization(status: LunariaStatus[number], lang: string) {
	const localization = status.localizations.find((localization) => localization.lang === lang);
	assert.ok(localization, `Expected a localization entry for ${lang}.`);
	return localization;
}
