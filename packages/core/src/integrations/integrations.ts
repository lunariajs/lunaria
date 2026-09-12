import type { ConsolaInstance } from 'consola';
import { validateFinalConfig, validateInitialConfig } from '../config/config.ts';
import type { LunariaUserConfig } from '../config/types.ts';
import { UnsupportedIntegrationSelfUpdate } from '../errors/errors.ts';
import type { CompleteLunariaUserConfig } from './types.ts';

export async function runSetupHook(config: LunariaUserConfig, logger: ConsolaInstance) {
	// If no integrations are present, we can just return the parsed config.
	if (!config.integrations) {
		return validateFinalConfig(config as CompleteLunariaUserConfig);
	}

	let lunariaConfig = config;

	for (const integration of config.integrations) {
		const {
			name,
			hooks: { setup },
		} = integration;

		// Skip to the next integration if no setup hook is found.
		if (!setup) continue;

		await setup({
			config: lunariaConfig,
			updateConfig: (newConfig: Partial<LunariaUserConfig>) => {
				if ('integrations' in newConfig) {
					throw new Error(UnsupportedIntegrationSelfUpdate.message(name));
				}

				// Not all integrations will add the missing fields, so we need to parse
				// for a final Lunaria config only at the end.
				lunariaConfig = validateInitialConfig({
					...lunariaConfig,
					...newConfig,
				});
			},
			logger,
		});
	}

	return validateFinalConfig(lunariaConfig as CompleteLunariaUserConfig);
}
