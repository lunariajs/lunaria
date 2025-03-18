import type { CompleteLunariaUserConfig } from '../src/integrations/types.ts';

export const sampleValidConfig: CompleteLunariaUserConfig = {
	repository: {
		name: 'yanthomasdev/lunaria',
	},
	sourceLocale: {
		label: 'English',
		lang: 'en',
	},
	locales: [
		{
			label: 'Spanish',
			lang: 'es',
		},
	],
	files: [
		{
			include: ['src/content/**/*.mdx'],
			pattern: 'src/content/@lang/@path',
			type: 'universal',
		},
	],
};
