import { resolve } from 'node:path';
import { ConfigNotFound, ConfigValidationError } from '../errors/errors.ts';
import { createJiti } from 'jiti';
import { LunariaPreSetupSchema } from '../integrations/schema.ts';
import type { CompleteLunariaUserConfig } from '../integrations/types.ts';
import { exists, parseWithFriendlyErrors } from '../utils/utils.ts';
import { LunariaConfigSchema } from './schema.ts';
import type { LunariaUserConfig } from './types.ts';

/**
 * Paths to search for the Lunaria config file,
 * sorted by how likely they're to appear.
 */
const configPaths = Object.freeze([
	'lunaria.config.mjs',
	'lunaria.config.js',
	'lunaria.config.ts',
	'lunaria.config.mts',
	'lunaria.config.cjs',
	'lunaria.config.cts',
]);

/** Finds the first `lunaria.config.*` file in the current working directoy and return its path.  */
async function findConfig() {
	for (const path of configPaths) {
		const resolvedPath = resolve(path);
		if (await exists(resolvedPath)) {
			return resolvedPath;
		}
	}

	return new Error(ConfigNotFound.message);
}

/** Loads a CJS/ESM `lunaria.config.*` file from the root of the current working directory. */
export async function loadConfig() {
	const path = await findConfig();
	if (path instanceof Error) {
		throw path;
	}

	const jiti = createJiti(import.meta.url);
	const mod = await jiti.import(path, { default: true });
	if (mod instanceof Error) {
		throw mod;
	}

	return validateInitialConfig(mod as LunariaUserConfig);
}

/** Validates the Lunaria config before the integrations' setup hook have run. */
export function validateInitialConfig(config: LunariaUserConfig) {
	return parseWithFriendlyErrors(LunariaPreSetupSchema, config, (issues) =>
		ConfigValidationError.message(issues),
	);
}

/** Validates the Lunaria config after all the integrations' setup hook have run. */
export function validateFinalConfig(config: CompleteLunariaUserConfig) {
	return parseWithFriendlyErrors(LunariaConfigSchema, config, (issues) =>
		ConfigValidationError.message(issues),
	);
}
