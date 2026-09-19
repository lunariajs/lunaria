import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { consola } from 'consola';
import { validateFinalConfig } from '../../src/config/config.ts';
import { LunariaGitInstance } from '../../src/status/git.ts';
import { createConfigFile, runCli, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('Shallow repositories', () => {
	it('should refuse to compute the status until the full history is available', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'guide.mdx': '# Guide\n' },
						es: { 'guide.mdx': '# Guía\n' },
					},
				},
			});
			repo.commitAllChanges('add guide', '2024-01-01');

			repo.writeFile('src/content/en/guide.mdx', '# Guide\n\nUpdated.\n');
			repo.commitAllChanges('update guide', '2024-02-01');

			const clonePath = repo.getFilePath('shallow-clone');
			repo.runInRepo('git', [
				'clone',
				'--quiet',
				'--depth',
				'1',
				pathToFileURL(repo.getRepoPath()).href,
				clonePath,
			]);
			repo.writeFile('shallow-clone/lunaria.config.mjs', createConfigFile(sampleValidConfig));

			process.chdir(clonePath);
			const git = new LunariaGitInstance(validateFinalConfig(sampleValidConfig), consola, {});
			assert.equal(await git.isShallowRepository(), true);

			const shallowRun = runCli(clonePath, ['build', '--force']);
			assert.notEqual(shallowRun.status, 0);
			assert.ok(shallowRun.stderr.includes('shallow clone'), shallowRun.stderr);
			assert.ok(shallowRun.stderr.includes('fetch-depth: 0'), shallowRun.stderr);

			await git.simpleGit.fetch(['--quiet', '--unshallow']);
			assert.equal(await git.isShallowRepository(), false);

			const fullRun = runCli(clonePath, ['build', '--force']);
			assert.equal(fullRun.status, 0, fullRun.stderr + fullRun.stdout);

			const [entry] = JSON.parse(
				readFileSync(join(clonePath, 'dist', 'lunaria', 'status.json'), 'utf8'),
			);
			assert.equal(entry.source.git.latestCommit.message, 'update guide');
			assert.equal(entry.localizations[0].status, 'outdated');
		});
	});
});
