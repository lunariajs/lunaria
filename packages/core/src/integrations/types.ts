import type { ConsolaInstance } from 'consola';
import type { File, Locale, LunariaUserConfig } from '../config/types.ts';

export interface LunariaIntegration {
	name: string;
	hooks: {
		setup?: (options: {
			config: LunariaUserConfig;
			updateConfig: (config: Partial<LunariaUserConfig>) => void;
			logger: ConsolaInstance;
		}) => void | Promise<void>;
	};
}

// This type exists to ensure it's a Lunaria user config that has all necessary fields.
// We use this to improve types for the Lunaria config during the setup hook.
export interface CompleteLunariaUserConfig extends LunariaUserConfig {
	sourceLocale: Locale;
	locales: [Locale, ...Locale[]];
	files: [File, ...File[]];
}
