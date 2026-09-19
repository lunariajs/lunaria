import type { LunariaConfig } from '../config/types.ts';
import type { LunariaStatus } from '../status/types.ts';
import { Page } from './components.ts';
import type { RendererUserConfig } from './types.ts';

/** Generates the HTML of the localization dashboard for the specified configuration and status. */
export function generateDashboard(config: LunariaConfig, status: LunariaStatus) {
	return Page(config, status);
}

/**
 * Wrapper function around your renderer configuration, use it to provide automatic type hints in your IDE.
 * The returned configuration can be passed to the `renderer` field of your Lunaria configuration.
 */
export function defineRendererConfig(config: RendererUserConfig): RendererUserConfig {
	return config;
}
