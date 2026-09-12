import { defineConfig } from '@lunariajs/core/config';

export default defineConfig({
	repository: {
		name: 'yanthomasdev/lunaria',
		rootDir: 'examples/starlight',
	},
	sourceLocale: {
		label: 'English',
		lang: 'en',
	},
	locales: [
		{
			label: 'Português',
			lang: 'pt',
		},
	],
	files: [
		{
			include: ['src/content/docs/**/*.(md|mdx)'],
			exclude: ['src/content/docs/pt/**/*.(md|mdx)'],
			pattern: {
				source: 'src/content/docs/@path',
				locales: 'src/content/docs/@lang/@path',
			},
			type: 'universal',
		},
		{
			include: ['src/content/i18n/en.yml'],
			pattern: {
				source: 'src/content/i18n/@lang.yml',
				locales: 'src/content/i18n/@lang.yml',
			},
			type: 'dictionary',
		},
		{
			include: ['src/content/i18n/en.ts'],
			pattern: {
				source: 'src/content/i18n/@lang.ts',
				locales: 'src/content/i18n/@lang.ts',
			},
			type: 'dictionary',
		},
	],
	tracking: {
		localizableProperty: 'i18nReady',
		ignoredKeywords: [
			'lunaria-ignore',
			'typo',
			'en-only',
			'broken link',
			'i18nReady',
			'i18nIgnore',
		],
	},
});
