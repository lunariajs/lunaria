#!/usr/bin/env node
import { logger } from './console.ts';
import { parseCommand } from './helpers.ts';
import type { CLI } from './types.ts';

const cli: CLI = {
	commands: [
		{
			name: 'build',
			description: 'Build your dashboard and status to disk.',
			usage: '[...options]',
			options: [
				{
					name: '--force',
					description: 'Ignore the cached git data and build the status from scratch.',
				},
			],
		},
		{
			name: 'init',
			description: 'Initialize Lunaria in your project.',
			usage: '[...options]',
		},
		{
			name: 'preview',
			description: 'Preview your built dashboard locally.',
			usage: '[...options]',
			options: [
				{
					name: '--port <number>',
					description: 'Specify which port to open the preview server on.',
				},
			],
		},
	],
	options: [
		{
			name: '--help',
			description: 'Show this help message.',
		},
		{
			name: '--config <path>',
			description: 'Specify the location of your config file.',
		},
	],
};

async function showHelp(command?: string) {
	const { help } = await import('./help/index.ts');
	help(cli, command);
}

/** CLI entrypoint */
async function main() {
	try {
		const { name, options } = parseCommand();

		if (name && options.help) {
			await showHelp(name);
			return;
		}

		switch (name) {
			case 'build': {
				const { build } = await import('./build/index.ts');
				await build(options);
				break;
			}
			case 'init': {
				const { init } = await import('./init/index.ts');
				await init(options);
				break;
			}
			case 'preview': {
				const { preview } = await import('./preview/index.ts');
				await preview(options);
				break;
			}
			default:
				await showHelp();
				break;
		}
	} catch (e) {
		/** Filter out parseArgs errors (invalid/unknown option) and instead show help */
		if (e instanceof TypeError && e?.stack?.includes('ERR_PARSE_ARGS')) await showHelp();
		else throw e;
	}
}

main().catch((e) => {
	logger.error(e instanceof Error ? e.message : e);
	process.exit(1);
});
