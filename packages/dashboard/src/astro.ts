import type { AstroIntegration } from 'astro';

export default function AstroLunariaDashboardIntegration(): AstroIntegration {
	return {
		name: '@lunariajs/dashboard',
		hooks: {
			'astro:config:setup': async ({ config, injectRoute, addWatchFile }) => {
				// Adds the Lunaria configuration file formats to the watch list
				// ensuring the dev server restarts whenever changes happen.
				addWatchFile(new URL('lunaria.config.js', config.root));
				addWatchFile(new URL('lunaria.config.ts', config.root));
				addWatchFile(new URL('lunaria.config.mjs', config.root));
				addWatchFile(new URL('lunaria.config.mts', config.root));
				addWatchFile(new URL('lunaria.config.cjs', config.root));
				addWatchFile(new URL('lunaria.config.cts', config.root));

				injectRoute({
					pattern: '/',
					entrypoint: '@lunariajs/dashboard/routes/index.astro',
				});

				injectRoute({
					pattern: '/locales',
					entrypoint: '@lunariajs/dashboard/routes/locales/index.astro',
				});

				injectRoute({
					pattern: '/locales/[lang]',
					entrypoint: '@lunariajs/dashboard/routes/locales/[lang]/index.astro',
				});

				injectRoute({
					pattern: '/locales/[lang]/[...path]',
					entrypoint: '@lunariajs/dashboard/routes/locales/[lang]/[...path].astro',
				});
			},
		},
	};
}
