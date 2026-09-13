import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateDashboard } from '../../dashboard/dashboard.ts';
import { StatusNotFound } from '../../errors/errors.ts';
import { serializeStatus } from '../../status/serialize.ts';
import type { LunariaStatus } from '../../status/types.ts';
import { bold, createCommandLogger, highlight } from '../console.ts';
import { createLunariaFromOptions, getFormattedTime } from '../helpers.ts';
import type { BuildOptions } from '../types.ts';

export async function build(options: BuildOptions) {
	const logger = createCommandLogger('build');
	const buildStartTime = performance.now();

	/** Command options */
	const skipStatus = options['skip-status'] ?? false;

	const lunaria = await createLunariaFromOptions(options);

	/** Output paths */
	const outDir = resolve(lunaria.config.outDir);
	const statusPath = join(outDir, 'status.json');
	const dashboardPath = join(outDir, 'index.html');

	/** Create the output directory if it doesn't exist yet. */
	if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

	logger.info(`Output directory: ${highlight(outDir)}`);

	/** Status */
	const statusStartTime = performance.now();
	logger.info(
		skipStatus ? 'Status build skipped, loading previous status...' : 'Building status...',
	);

	const status = skipStatus ? readStatus(statusPath) : await lunaria.getFullStatus();

	/** Save status to disk if the status build wasn't skipped. */
	if (!skipStatus) writeFileSync(statusPath, JSON.stringify(serializeStatus(status), null, 2));

	logger.success(`Completed in ${getFormattedTime(statusStartTime, performance.now())}`);

	/** Dashboard */
	const dashboardStartTime = performance.now();
	logger.info('Building dashboard...');

	writeFileSync(dashboardPath, generateDashboard(lunaria.config, status));

	logger.success(`Completed in ${getFormattedTime(dashboardStartTime, performance.now())}`);

	/** End build */
	logger.info(
		`${bold('Complete!')} Built in ${getFormattedTime(buildStartTime, performance.now())}`,
	);
}

/** Loads the most recent status from disk, used when the status build is skipped. */
function readStatus(statusPath: string) {
	if (!existsSync(statusPath)) {
		throw new Error(StatusNotFound.message(statusPath));
	}

	// The status written to disk doesn't include the files' contents, which the dashboard doesn't need.
	return JSON.parse(readFileSync(statusPath, 'utf-8')) as LunariaStatus;
}
