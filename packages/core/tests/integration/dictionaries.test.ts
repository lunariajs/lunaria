import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLunaria } from '../../src/index.ts';
import type { CompleteLunariaUserConfig } from '../../src/integrations/types.ts';
import { getLocalization, sampleValidConfig, withTestRepo } from '../utils.ts';

describe('Dictionaries', () => {
	it('should report missing dictionary keys', async () => {
		await withTestRepo(async (repo) => {
			const sourceDictionary = { hello: 'Hello', bye: 'Bye' };
			const localeDictionary = { hello: 'Hola' };

			repo.writeFile('src/i18n/en.json', JSON.stringify(sourceDictionary));
			repo.writeFile('src/i18n/es.json', JSON.stringify(localeDictionary));
			repo.commitAllChanges('add dictionaries', '2024-01-01');

			const config = {
				...sampleValidConfig,
				files: [
					{
						include: ['src/i18n/en.json'],
						pattern: 'src/i18n/@lang.json',
						type: 'dictionary',
					},
				],
			} satisfies CompleteLunariaUserConfig;

			const lunaria = await createLunaria({ config, force: true, logLevel: 'silent' });
			const status = await lunaria.getFileStatus('src/i18n/en.json');
			assert.ok(status);

			const localization = getLocalization(status, 'es');
			if (localization.status === 'missing') {
				assert.fail('Expected Spanish dictionary localization to exist.');
			}

			assert.equal(localization.status, 'up-to-date');
			assert.equal(localization.type, 'dictionary');
			assert.deepEqual(localization.missingKeys, [['bye']]);
		});
	});

	it('should apply dictionary merge and optional keys', async () => {
		await withTestRepo(async (repo) => {
			const sourceDictionary = {
				hello: 'Hello',
				inherited: 'Inherited',
				optional: 'Optional',
				missing: 'Missing',
			};
			const baseDictionary = { hello: 'Hola', inherited: 'Heredado' };
			const localeDictionary = { hello: 'Hola regional' };

			repo.writeFile('src/i18n/en.json', JSON.stringify(sourceDictionary));
			repo.writeFile('src/i18n/es.json', JSON.stringify(baseDictionary));
			repo.writeFile('src/i18n/es-LAT.json', JSON.stringify(localeDictionary));
			repo.commitAllChanges('add merged dictionaries', '2024-01-01');

			const config = {
				...sampleValidConfig,
				locales: [
					{ label: 'Spanish', lang: 'es' },
					{ label: 'Latin American Spanish', lang: 'es-LAT' },
				],
				files: [
					{
						include: ['src/i18n/en.json'],
						pattern: 'src/i18n/@lang.json',
						type: 'dictionary',
						merge: { 'es-LAT': ['es'] },
						optionalKeys: { optional: true },
					},
				],
			} satisfies CompleteLunariaUserConfig;

			const lunaria = await createLunaria({ config, force: true, logLevel: 'silent' });
			const status = await lunaria.getFileStatus('src/i18n/en.json');
			assert.ok(status);

			const localization = getLocalization(status, 'es-LAT');
			if (localization.status === 'missing') {
				assert.fail('Expected regional Spanish dictionary localization to exist.');
			}

			assert.equal(localization.type, 'dictionary');
			assert.deepEqual(localization.missingKeys, [['missing']]);
		});
	});
});
