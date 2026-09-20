// TODO(HiDeoo) Revert all changes in this file.

import { type Locale } from '@lunariajs/core';
import { defineConfig } from '@lunariajs/core/config';

export const locales = [
	{ label: 'Dansk', lang: 'da' },
	{ label: 'Deutsch', lang: 'de' },
	{ label: 'Español', lang: 'es' },
	{ label: 'فارسی', lang: 'fa' },
	{ label: 'Français', lang: 'fr' },
	{ label: 'हिंदी', lang: 'hi' },
	{ label: 'Bahasa Indonesia', lang: 'id' },
	{ label: 'Italiano', lang: 'it' },
	{ label: '日本語', lang: 'ja' },
	{ label: '한국어', lang: 'ko' },
	{ label: 'Português do Brasil', lang: 'pt-br' },
	{ label: 'Português', lang: 'pt-pt' },
	{ label: 'Русский', lang: 'ru' },
	{ label: 'Türkçe', lang: 'tr' },
	{ label: 'Українська', lang: 'uk' },
	{ label: '简体中文', lang: 'zh-cn' },
] satisfies [Locale, ...Locale[]];

export default defineConfig({
	repository: {
		name: 'yanthomasdev/lunaria',
		rootDir: 'examples/starlight',
	},
	sourceLocale: {
		label: 'English',
		lang: 'en',
	},
	locales,
	files: [
		{
			include: ['src/content/docs/**/*.{md,mdx}'],
			exclude: locales.map((locale) => `src/content/docs/${locale.lang}/**`),
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
	dashboard: {
		title: 'Starlight Example Localization Status',
		basesToHide: ['src/content/docs/', 'src/content/i18n/'],
	},
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
