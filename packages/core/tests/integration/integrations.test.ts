import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLunaria } from '../../src/index.ts';
import type { LunariaIntegration } from '../../src/integrations/types.ts';
import { getLocalization, withTestRepo } from '../utils.ts';

describe('Integrations', () => {
	it('should run setup integrations before creating status', async () => {
		await withTestRepo(async (repo) => {
			repo.writeFileTree({
				src: {
					content: {
						en: { 'setup.mdx': '# Setup\n' },
						es: { 'setup.mdx': '# Configuracion\n' },
					},
				},
			});
			repo.commitAllChanges('add setup docs', '2024-01-01');

			const integration = {
				name: '@lunariajs/test',
				hooks: {
					setup: ({ updateConfig }) =>
						updateConfig({
							sourceLocale: { label: 'English', lang: 'en' },
							locales: [{ label: 'Spanish', lang: 'es' }],
							files: [
								{
									include: ['src/content/**/*.mdx'],
									pattern: 'src/content/@lang/@path',
									type: 'universal',
								},
							],
						}),
				},
			} satisfies LunariaIntegration;

			const lunaria = await createLunaria({
				config: {
					repository: { name: 'lunaria/test' },
					integrations: [integration],
				},
				force: true,
				logLevel: 'silent',
			});
			const status = await lunaria.getFileStatus('src/content/en/setup.mdx');
			assert.ok(status);

			assert.equal(status.source.path, 'src/content/en/setup.mdx');
			assert.equal(getLocalization(status, 'es').status, 'up-to-date');
		});
	});
});
