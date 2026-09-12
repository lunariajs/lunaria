import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const locales = {
	root: {
		label: 'English',
		lang: 'en',
	},
	pt: {
		label: 'Português',
		lang: 'pt-BR',
	},
};

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			plugins: [],
			title: 'My Docs',
			locales,
			social: {
				github: 'https://github.com/withastro/starlight',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [{ label: 'Example Guide', link: '/guides/example/' }],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
