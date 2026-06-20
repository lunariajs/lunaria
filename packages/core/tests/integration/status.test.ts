import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLunaria } from '../../src/index.ts';
import { getLocalization, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('Status', () => {
	it('should return public git metadata from real commits', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'history.mdx': '# History\n' },
						es: { 'history.mdx': '# Historia\n' },
					},
				},
			});
			repo.commitAllChanges('add history file', '2024-01-01');

			repo.writeFile('src/content/en/history.mdx', '# History\n\nUpdated.\n');
			const latestHash = repo.commitAllChanges('update history file', '2024-02-01T12:30:00Z');

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});
			const status = await lunaria.getFileStatus('src/content/en/history.mdx');
			assert.ok(status);

			assert.equal(status.source.path, 'src/content/en/history.mdx');
			assert.equal(status.source.git.latestCommit.hash, latestHash);
			assert.equal(status.source.git.latestTrackedCommit.hash, latestHash);
			assert.equal(status.source.git.latestCommit.message, 'update history file');
			assert.equal(status.source.git.latestCommit.author.name, 'lunaria-test');
			assert.equal(status.source.git.latestCommit.author.email, 'lunaria-test@example.com');
			assert.equal(status.source.git.latestCommit.date.toISOString(), '2024-02-01T12:30:00.000Z');
			assert.equal(getLocalization(status, 'es').status, 'outdated');
		});
	});

	it('should report missing, outdated, and up-to-date localizations', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: {
							'current.mdx': '# Current\n',
							'missing.mdx': '# Missing\n',
							'outdated.mdx': '# Outdated\n',
						},
						es: {
							'current.mdx': '# Actual\n',
							'outdated.mdx': '# Desactualizado\n',
						},
					},
				},
			});
			repo.commitAllChanges('add docs', '2024-01-01');

			repo.writeFile('src/content/en/outdated.mdx', '# Outdated\n\nNew source content.\n');
			repo.commitAllChanges('update outdated source', '2024-02-01');

			repo.writeFile('src/content/es/current.mdx', '# Actual\n\nUpdated translation.\n');
			repo.commitAllChanges('update current translation', '2024-03-01');

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});

			const status = await lunaria.getFullStatus();
			const localizationStatuses = Object.fromEntries(
				status.map((entry) => [entry.source.path, getLocalization(entry, 'es').status]),
			);

			assert.equal(status.length, 3);
			assert.deepEqual(localizationStatuses, {
				'src/content/en/current.mdx': 'up-to-date',
				'src/content/en/missing.mdx': 'missing',
				'src/content/en/outdated.mdx': 'outdated',
			});
		});
	});

	it('should return status when called with a locale path', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'locale-path.mdx': '# Locale path\n' },
						es: { 'locale-path.mdx': '# Ruta de locale\n' },
					},
				},
			});
			repo.commitAllChanges('add locale path doc', '2024-01-01');

			const lunaria = await createLunaria({
				config: sampleValidConfig,
				force: true,
				logLevel: 'silent',
			});

			const status = await lunaria.getFileStatus('src/content/es/locale-path.mdx');
			assert.ok(status);
			const localization = getLocalization(status, 'es');

			assert.equal(status.source.path, 'src/content/en/locale-path.mdx');
			assert.equal(localization.path, 'src/content/es/locale-path.mdx');
			assert.equal(localization.status, 'up-to-date');
		});
	});

	it('should only include localizable source files', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: {
							'localizable.mdx': '---\nlocalizable: true\n---\n# Localizable\n',
							'disabled.mdx': '---\nlocalizable: false\n---\n# Disabled\n',
							'missing-property.mdx': '---\ntitle: Missing\n---\n# Missing property\n',
							'invalid-property.mdx': '---\nlocalizable: 1\n---\n# Invalid property\n',
						},
						es: {
							'localizable.mdx': '# Localizable ES\n',
						},
					},
				},
			});
			repo.commitAllChanges('add localizable docs', '2024-01-01');

			const lunaria = await createLunaria({
				config: {
					...sampleValidConfig,
					tracking: { localizableProperty: 'localizable' },
				},
				force: true,
				logLevel: 'silent',
			});

			const status = await lunaria.getFullStatus();

			assert.deepEqual(
				status.map((entry) => entry.source.path),
				['src/content/en/localizable.mdx'],
			);
		});
	});
});
