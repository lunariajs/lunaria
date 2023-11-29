import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
	entries: ['src/create-lunaria'],
	rollup: {
		esbuild: {
			minify: true,
		},
	},
});
