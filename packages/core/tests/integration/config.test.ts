import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { findConfigPath, isDefaultConfigPath } from '../../src/config/config.ts';
import { createLunaria } from '../../src/index.ts';
import { createConfigFile, getLocalization, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('Configuration', () => {
	it('should load config from a lunaria.config file', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'config.mdx': '# Config\n' },
						es: { 'config.mdx': '# Configuracion\n' },
					},
				},
			});
			repo.writeFile('lunaria.config.mjs', createConfigFile(sampleValidConfig));
			repo.commitAllChanges('add config and docs', '2024-01-01');

			const lunaria = await createLunaria({ force: true, logLevel: 'silent' });
			const status = await lunaria.getFileStatus('src/content/en/config.mdx');
			assert.ok(status);

			assert.equal(status.source.path, 'src/content/en/config.mdx');
			assert.equal(getLocalization(status, 'es').status, 'up-to-date');
		});
	});
	it('should find the config file that is loaded automatically', async () => {
		await withTestRepo(async (repo) => {
			assert.equal(await findConfigPath(), undefined);

			repo.writeFile('lunaria.config.ts', createConfigFile(sampleValidConfig));
			repo.writeFile('lunaria.config.mjs', createConfigFile(sampleValidConfig));

			// The most likely extensions take precedence, in the same order used by `loadConfig()`.
			assert.equal(await findConfigPath(), repo.getFilePath('lunaria.config.mjs'));
			assert.equal(
				await findConfigPath('./lunaria.config.ts'),
				repo.getFilePath('lunaria.config.ts'),
			);
			assert.equal(await findConfigPath('./nope.config.mjs'), undefined);

			assert.equal(isDefaultConfigPath('./lunaria.config.cts'), true);
			assert.equal(isDefaultConfigPath('./config/lunaria.config.mjs'), false);
		});
	});
});
