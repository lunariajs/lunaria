import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightBlog from 'starlight-blog';
import starlightLinksValidator from 'starlight-links-validator';

const site = 'https://lunaria.dev/';

// https://astro.build/config
export default defineConfig({
	site,
	integrations: [
		starlight({
			title: 'Lunaria',
			logo: {
				light: './src/assets/logo-light.svg',
				dark: './src/assets/logo-dark.svg',
				replacesTitle: true,
			},
			social: {
				github: 'https://github.com/yanthomasdev/lunaria',
			},
			editLink: {
				baseUrl: 'https://github.com/yanthomasdev/lunaria/edit/main/docs/',
			},
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: `${site}og.jpg?v=1` },
				},
				{
					tag: 'meta',
					attrs: { property: 'twitter:image', content: `${site}og.jpg?v=1` },
				},
				{
					tag: 'script',
					attrs: {
						defer: true,
						src: 'https://assets.onedollarstats.com/stonks.js',
					},
				},
			],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{
							label: 'Getting Started',
							link: 'getting-started',
						},
						{
							label: 'Manual Installation',
							link: 'manual-installation',
						},
						{
							label: 'Recommendations',
							link: 'recommendations',
						},
						{
							label: 'Showcase',
							link: 'showcase',
						},
					],
				},
				{
					label: 'Guides',
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Integrations',
					autogenerate: { directory: 'integrations' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
			customCss: ['./src/styles/theme.css', './src/styles/landing.css'],
			plugins: [starlightLinksValidator(), starlightBlog()],
		}),
	],
});
