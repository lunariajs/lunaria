import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLunaria } from '../../src/index.ts';
import type { CompleteLunariaUserConfig } from '../../src/integrations/types.ts';
import { getLocalization, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('Tracking', () => {
	it('should track source files matching include, exclude, and files entries', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: {
							'page.mdx': '# Page\n',
							'draft.mdx': '# Draft\n',
						},
						es: {
							'locale-only.mdx': '# Locale only\n',
						},
					},
				},
				docs: {
					'guide.md': '# Guide\n',
				},
				i18n: {
					es: {
						'guide.md': '# Guia\n',
					},
				},
			});

			const config = {
				...sampleValidConfig,
				files: [
					{
						include: ['src/content/**/*.mdx'],
						exclude: ['src/content/**/draft.mdx'],
						pattern: 'src/content/@lang/@path',
						type: 'universal',
					},
					{
						include: ['docs/**/*.md'],
						pattern: {
							source: 'docs/@path',
							locales: 'i18n/@lang/@path',
						},
						type: 'universal',
					},
				],
			} satisfies CompleteLunariaUserConfig;

			const lunaria = await createLunaria({
				config,
				force: true,
				logLevel: 'silent',
			});
			const sourcePaths = await lunaria.getSourcePaths();

			assert.deepEqual(sourcePaths, ['src/content/en/page.mdx', 'docs/guide.md']);
		});
	});

	it('should ignore commits with @lunaria-ignore directives', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'guide.mdx': '# Guide\n' },
						es: { 'guide.mdx': '# Guia\n' },
					},
				},
			});
			const trackedHash = repo.commitAllChanges('add guide', '2024-01-01');

			repo.writeFile('src/content/en/guide.mdx', '# Guide\n\nFormatting-only change.\n');
			const ignoredHash = repo.commitAllChanges(
				'update guide formatting',
				'2024-02-01',
				'@lunaria-ignore:src/content/en/guide.mdx',
			);

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});

			const status = await lunaria.getFileStatus('src/content/en/guide.mdx');
			assert.ok(status);

			assert.equal(status.source.git.latestCommit.hash, ignoredHash);
			assert.equal(status.source.git.latestTrackedCommit.hash, trackedHash);
			assert.equal(getLocalization(status, 'es').status, 'up-to-date');
		});
	});

	it('should ignore commits with configured ignored keywords', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'keywords.mdx': '# Keywords\n' },
						es: { 'keywords.mdx': '# Palabras clave\n' },
					},
				},
			});
			const trackedHash = repo.commitAllChanges('add keywords doc', '2024-01-01');

			repo.writeFile('src/content/en/keywords.mdx', '# Keywords\n\nTypo fixed.\n');
			const ignoredHash = repo.commitAllChanges('fix typo in keywords doc', '2024-02-01');

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});

			const status = await lunaria.getFileStatus('src/content/en/keywords.mdx');
			assert.ok(status);

			assert.equal(status.source.git.latestCommit.hash, ignoredHash);
			assert.equal(status.source.git.latestTrackedCommit.hash, trackedHash);
			assert.equal(getLocalization(status, 'es').status, 'up-to-date');
		});
	});

	it('should track only commits with matching @lunaria-track directives', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: {
							'current.mdx': '# Current\n',
							'other.mdx': '# Other\n',
						},
						es: {
							'current.mdx': '# Actual\n',
							'other.mdx': '# Otro\n',
						},
					},
				},
			});
			const initialHash = repo.commitAllChanges('add tracked docs', '2024-01-01');

			repo.writeFile('src/content/en/current.mdx', '# Current\n\nUpdated.\n');
			repo.writeFile('src/content/en/other.mdx', '# Other\n\nUpdated.\n');
			const directiveHash = repo.commitAllChanges(
				'update tracked docs',
				'2024-02-01',
				'@lunaria-track:src/content/en/other.mdx',
			);

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});

			const currentStatus = await lunaria.getFileStatus('src/content/en/current.mdx');
			const otherStatus = await lunaria.getFileStatus('src/content/en/other.mdx');
			assert.ok(currentStatus);
			assert.ok(otherStatus);

			assert.equal(currentStatus.source.git.latestCommit.hash, directiveHash);
			assert.equal(currentStatus.source.git.latestTrackedCommit.hash, initialHash);
			assert.equal(otherStatus.source.git.latestCommit.hash, directiveHash);
			assert.equal(otherStatus.source.git.latestTrackedCommit.hash, directiveHash);
		});
	});

	it('should keep status correct after cache reuse', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'cache.mdx': '# Cache\n' },
						es: { 'cache.mdx': '# Cache ES\n' },
					},
				},
			});
			const trackedHash = repo.commitAllChanges('add cached doc', '2024-01-01');

			const firstLunaria = await createLunaria({
				config: sampleValidConfig,
				logLevel: 'silent',
			});
			await firstLunaria.getFullStatus();

			repo.writeFile('src/content/en/cache.mdx', '# Cache\n\nTypo fixed.\n');
			const ignoredHash = repo.commitAllChanges('fix typo in cached doc', '2024-02-01');

			const secondLunaria = await createLunaria({
				config: sampleValidConfig,
				logLevel: 'silent',
			});
			const status = await secondLunaria.getFileStatus('src/content/en/cache.mdx');
			assert.ok(status);

			assert.equal(status.source.git.latestCommit.hash, ignoredHash);
			assert.equal(status.source.git.latestTrackedCommit.hash, trackedHash);
		});
	});

	it('should invalidate cached tracking data when tracking config changes', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'cache-config.mdx': '# Cache config\n' },
						es: { 'cache-config.mdx': '# Cache config ES\n' },
					},
				},
			});
			repo.commitAllChanges('add cache config doc', '2024-01-01');

			repo.writeFile('src/content/en/cache-config.mdx', '# Cache config\n\nUpdated.\n');
			const latestHash = repo.commitAllChanges('skip-l10n cache config update', '2024-02-01');

			const firstLunaria = await createLunaria({
				config: {
					...sampleValidConfig,
					tracking: { ignoredKeywords: ['skip-l10n'] },
				},
				logLevel: 'silent',
			});
			await firstLunaria.getFileStatus('src/content/en/cache-config.mdx');

			const secondLunaria = await createLunaria({
				config: {
					...sampleValidConfig,
					tracking: { ignoredKeywords: ['unrelated-keyword'] },
				},
				logLevel: 'silent',
			});
			const status = await secondLunaria.getFileStatus('src/content/en/cache-config.mdx');
			assert.ok(status);

			assert.equal(status.source.git.latestTrackedCommit.hash, latestHash);
		});
	});
});
