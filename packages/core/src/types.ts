import type { LunariaUserConfig } from './config/types.ts';
import type { CONSOLE_LEVELS } from './constants.ts';

export interface LunariaOpts {
	logLevel?: keyof typeof CONSOLE_LEVELS;
	force?: boolean;
	config?: LunariaUserConfig;
}
