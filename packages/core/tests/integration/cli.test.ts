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

	it('should pass the status to renderer components', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				// Renderer components are functions, so this configuration is written as a module by hand.
				'lunaria.config.mjs': `export default {
	...${JSON.stringify(sampleValidConfig)},
	renderer: {
		overrides: {
			statusByFile: (_, status) =>
				'<ul>' +
				status
					.map((entry) => '<li>' + entry.source.git.latestCommit.date.toISOString() + '</li>')
					.join('') +
				'</ul>',
		},
	},
};
`,
				src: { content: { en: { 'guide.mdx': '# Guide\n' }, es: { 'guide.mdx': '# Guía\n' } } },
			});
			repo.commitAllChanges('add docs', '2024-01-01');

			const result = runCli(repo.getRepoPath(), ['build', '--force']);
			assert.equal(result.status, 0, result.stderr + result.stdout);

			const dashboard = readFileSync(
				repo.getFilePath(join('dist', 'lunaria', 'index.html')),
				'utf8',
			);
			assert.ok(dashboard.includes('<li>2024-01-01T00:00:00.000Z</li>'));
		});
	});

	it('should show the help message', async () => {
		await withTestRepo(async (repo) => {
			const result = runCli(repo.getRepoPath(), ['--help']);
			assert.equal(result.status, 0);
			for (const command of ['build', 'init', 'preview']) {
				assert.ok(result.stdout.includes(command));
			}

			const commandHelp = runCli(repo.getRepoPath(), ['build', '--help']);
			assert.ok(commandHelp.stdout.includes('--force'));
		});
	});
	it('should fail on unknown commands and options', async () => {
		await withTestRepo(async (repo) => {
			const unknownCommand = runCli(repo.getRepoPath(), ['bulid']);
			assert.equal(unknownCommand.status, 1);
			assert.match(unknownCommand.stderr, /Unknown command.*bulid/);
			assert.ok(unknownCommand.stdout.includes('Commands'), unknownCommand.stdout);

			const unknownOption = runCli(repo.getRepoPath(), ['build', '--skip-stauts']);
			assert.equal(unknownOption.status, 1);
			assert.ok(unknownOption.stderr.includes('--skip-stauts'), unknownOption.stderr);
			assert.ok(unknownOption.stdout.includes('lunaria build'), unknownOption.stdout);
		});
	});
	it('should preview the dashboard from the output directory set by integrations', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				// Integration hooks are functions, so this configuration is written as a module by hand.
				'lunaria.config.mjs': `export default {
	...${JSON.stringify(sampleValidConfig)},
	integrations: [
		{
			name: 'test',
			hooks: { setup: ({ updateConfig }) => updateConfig({ outDir: './out-sync' }) },
		},
	],
};
`,
			});

			// Without a build, the error names the directory the dashboard was looked for in.
			const result = runCli(repo.getRepoPath(), ['preview']);
			assert.notEqual(result.status, 0);
			assert.ok(result.stderr.includes('out-sync'), result.stderr);
		});
	});
});
