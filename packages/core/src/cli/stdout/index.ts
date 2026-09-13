import { serializeStatus } from '../../status/serialize.ts';
import { createLunariaFromOptions } from '../helpers.ts';
import type { StdoutOptions } from '../types.ts';

export async function stdout(options: StdoutOptions) {
	// Only warnings and errors are logged (to stderr) to keep the output parsable.
	const lunaria = await createLunariaFromOptions(options, 'warn');
	const status = await lunaria.getFullStatus();

	process.stdout.write(`${JSON.stringify([lunaria.config, serializeStatus(status)])}\n`);
}
