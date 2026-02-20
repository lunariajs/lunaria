import { glob, type Loader } from 'astro/loaders';

export default function lunariaLoader(base?: string): Loader {
	return {
		name: 'lunaria-dashboard-loader',
		load: (context) => {
			const extensions = ['markdown', 'mdown', 'mkdn', 'mkd', 'mdwn', 'md', 'mdx'];

			// Adds Markdoc to the list of globbed files if the integration is presentq.
			if (context.config.integrations.find(({ name }) => name === '@astrojs/markdoc')) {
				extensions.push('mdoc');
			}

			return glob({
				base: new URL(base || 'src/content/lunaria', context.config.root),
				pattern: `**/[^_]*.{${extensions.join(',')}}`,
			}).load(context);
		},
	};
}
