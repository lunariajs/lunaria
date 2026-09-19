import { parseArgs } from 'node:util';
import { loadConfig } from '../config/config.ts';
import { createLunaria } from '../index.ts';
import type { GlobalOptions } from './types.ts';

/** The configuration file created by `lunaria init` when no `--config` path is specified. */
export const DEFAULT_CONFIG_PATH = './lunaria.config.mjs';

export function parseCommand() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: {
			help: {
				type: 'boolean',
			},
			config: {
				type: 'string',
			},
			/** Build command */
			force: {
				type: 'boolean',
			},
			/** Preview command */
			port: {
				type: 'string',
			},
		},
	});

	return {
		name: positionals[0],
		options: values,
	};
}

export function getFormattedTime(start: number, end: number) {
	const seconds = (end - start) / 1000;
	return `${seconds.toFixed(2)}s`;
}

/**
 * Creates a Lunaria instance from the CLI options, loading the configuration from
 * the `--config` path when specified, otherwise from the current working directory.
 */
export async function createLunariaFromOptions(
	options: GlobalOptions & { force?: boolean | undefined },
) {
	const config = options.config ? await loadConfig(options.config) : undefined;

	return createLunaria({ config, force: options.force });
}
