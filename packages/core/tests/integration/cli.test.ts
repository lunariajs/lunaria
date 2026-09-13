import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createConfigFile, runCli, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('CLI', () => {
	it('should build the status and dashboard to disk', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				'lunaria.config.mjs': createConfigFile({
					...sampleValidConfig,
					dashboard: { title: 'Test Dashboard' },
				}),
				src: {
					content: {
						en: { 'guide.mdx': '# Guide\n', 'missing.mdx': '# Missing\n' },
						es: { 'guide.mdx': '# Guía\n' },
					},
				},
			});
			repo.commitAllChanges('add docs', '2024-01-01');

			const result = runCli(repo.getRepoPath(), ['build', '--force']);
			assert.equal(result.status, 0, result.stderr + result.stdout);

			const statusPath = repo.getFilePath(join('dist', 'lunaria', 'status.json'));
			const dashboardPath = repo.getFilePath(join('dist', 'lunaria', 'index.html'));
			assert.ok(existsSync(statusPath));
			assert.ok(existsSync(dashboardPath));

			const status = JSON.parse(readFileSync(statusPath, 'utf8'));
			assert.deepEqual(
				status.map((entry: { source: { path: string } }) => entry.source.path),
				['src/content/en/guide.mdx', 'src/content/en/missing.mdx'],
			);
			// The files' contents are not written to disk.
			assert.equal(status[0].source.contents, undefined);
			assert.equal(status[0].localizations[0].contents, undefined);

			const dashboard = readFileSync(dashboardPath, 'utf8');
			assert.ok(dashboard.includes('<title>Test Dashboard</title>'));
			assert.ok(dashboard.includes('1 done, 0 outdated, 1 missing'));

			// Skipping the status build reuses the status written to disk.
			const skipped = runCli(repo.getRepoPath(), ['build', '--skip-status']);
			assert.equal(skipped.status, 0, skipped.stderr + skipped.stdout);
			assert.ok(readFileSync(dashboardPath, 'utf8').includes('<title>Test Dashboard</title>'));
		});
	});

	it('should load the configuration from the `--config` path', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				config: {
					'custom.config.mjs': createConfigFile({
						...sampleValidConfig,
						dashboard: { title: 'Custom Path' },
					}),
				},
				src: { content: { en: { 'guide.mdx': '# Guide\n' } } },
			});
			repo.commitAllChanges('add docs', '2024-01-01');

			const result = runCli(repo.getRepoPath(), [
				'build',
				'--force',
				'--config',
				'./config/custom.config.mjs',
			]);
			assert.equal(result.status, 0, result.stderr + result.stdout);

			const dashboard = readFileSync(
				repo.getFilePath(join('dist', 'lunaria', 'index.html')),
				'utf8',
			);
			assert.ok(dashboard.includes('<title>Custom Path</title>'));

			const missing = runCli(repo.getRepoPath(), ['build', '--config', './nope.config.mjs']);
			assert.notEqual(missing.status, 0);
			assert.ok(missing.stderr.includes('./nope.config.mjs'));
		});
	});

	it('should log the configuration and status to stdout', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				'lunaria.config.mjs': createConfigFile({
					...sampleValidConfig,
					dashboard: { title: 'Test Dashboard' },
				}),
				src: { content: { en: { 'guide.mdx': '# Guide\n' }, es: { 'guide.mdx': '# Guía\n' } } },
			});
			repo.commitAllChanges('add docs', '2024-01-01');

			const result = runCli(repo.getRepoPath(), ['stdout', '--force']);
			assert.equal(result.status, 0, result.stderr + result.stdout);

			const [config, status] = JSON.parse(result.stdout);
			assert.equal(config.dashboard.title, 'Test Dashboard');
			assert.equal(config.outDir, './dist/lunaria');
			assert.equal(status[0].localizations[0].status, 'up-to-date');
		});
	});

	it('should show the help message', async () => {
		await withTestRepo(async (repo) => {
			const result = runCli(repo.getRepoPath(), ['--help']);
			assert.equal(result.status, 0);
			for (const command of ['build', 'init', 'preview', 'stdout']) {
				assert.ok(result.stdout.includes(command));
			}

			const commandHelp = runCli(repo.getRepoPath(), ['build', '--help']);
			assert.ok(commandHelp.stdout.includes('--skip-status'));
		});
	});
});
