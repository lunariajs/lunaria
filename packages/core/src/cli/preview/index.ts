import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import { loadConfig } from '../../config/config.ts';
import { DashboardNotFound } from '../../errors/errors.ts';
import { runSetupHook } from '../../integrations/integrations.ts';
import { bold, createCommandLogger, highlight } from '../console.ts';
import type { PreviewOptions } from '../types.ts';

export async function preview(options: PreviewOptions) {
	const logger = createCommandLogger('preview');
	const requestedPort = options.port ? Number.parseInt(options.port, 10) : 3000;

	const config = await runSetupHook(await loadConfig(options.config), logger);

	const outDir = resolve(config.outDir);
	const dashboardPath = join(outDir, 'index.html');

	if (!existsSync(dashboardPath)) {
		throw new Error(DashboardNotFound.message(dashboardPath));
	}

	const server = http.createServer((_, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(readFileSync(dashboardPath));
	});

	const port = await listen(server, requestedPort);

	logger.info(`Server open on ${highlight(`http://localhost:${port.toString()}/`)}`);
	logger.info(`Press ${bold('CTRL + C')} to close it.`);
}

/** Starts the server on the requested port, falling back to a random available port if it is already in use. */
function listen(server: http.Server, port: number) {
	return new Promise<number>((resolvePort, reject) => {
		server.once('error', (error: NodeJS.ErrnoException) => {
			if (error.code === 'EADDRINUSE' && port !== 0) {
				listen(server, 0).then(resolvePort, reject);
				return;
			}

			reject(error);
		});

		server.listen(port, () => {
			resolvePort((server.address() as AddressInfo).port);
		});
	});
}
