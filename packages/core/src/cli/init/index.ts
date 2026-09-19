import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ConsolaInstance } from 'consola';
import { findConfigPath, isDefaultConfigPath } from '../../config/config.ts';
import type { GitHostingOptions } from '../../config/types.ts';
import { isRelative } from '../../utils/utils.ts';
import { bold, createCommandLogger, exitOnCancel, highlight } from '../console.ts';
import { DEFAULT_CONFIG_PATH } from '../helpers.ts';
import type { InitOptions, PackageJson } from '../types.ts';

export async function init(options: InitOptions) {
	const logger = createCommandLogger('init');
	const configPath = resolve(options.config ?? DEFAULT_CONFIG_PATH);
	const packageJsonPath = resolve('./package.json');

	// The new file replaces the one at its path or, when it is one of the files found automatically,
	// any other `lunaria.config.*` file, which would otherwise be loaded instead of the new one.
	const existingConfigPath = existsSync(configPath)
		? configPath
		: isDefaultConfigPath(configPath)
			? await findConfigPath()
			: undefined;

	if (existingConfigPath) {
		const overwrite = exitOnCancel(
			await logger.prompt(
				`A configuration file already exists at ${highlight(existingConfigPath)}. Overwrite it?`,
				{
					type: 'confirm',
					initial: false,
					cancel: 'symbol',
				},
			),
		);

		if (!overwrite) {
			logger.info('Keeping the existing configuration, no changes were made.');
			return;
		}
	}

	const hosting = exitOnCancel(
		await logger.prompt('What is the git hosting of your repository?', {
			type: 'select',
			options: [
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' },
			],
			cancel: 'symbol',
		}),
	) as GitHostingOptions;

	const name = await promptRequiredText(logger, 'What is the unique name of your repository?', {
		placeholder: 'lunariajs/lunaria',
		validate: (value) => (value.length < 1 ? 'The repository name cannot be empty.' : undefined),
	});

	const branch = await promptRequiredText(logger, 'What is the main branch of your repository?', {
		placeholder: 'main',
		defaultValue: 'main',
		validate: (value) => (value.length < 1 ? 'The branch name cannot be empty.' : undefined),
	});

	const isMonorepo = exitOnCancel(
		await logger.prompt("Are you setting Lunaria on a monorepo's project?", {
			type: 'confirm',
			initial: false,
			cancel: 'symbol',
		}),
	);

	const rootDir = isMonorepo
		? await promptRequiredText(logger, 'What is the root directory of your project?', {
				placeholder: 'docs',
				validate: (value) => {
					if (value.length < 1) return 'The root directory cannot be empty.';
					if (isRelative(value)) return 'The root directory cannot be a relative path.';
					if (value.endsWith('/')) return 'The root directory cannot end with a trailing slash.';
					return undefined;
				},
			})
		: undefined;

	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, createConfigFile({ hosting, name, branch, rootDir }));

	// The first `lunaria.config.*` file found is the one loaded, so a previous configuration with
	// another extension is removed to ensure the new one is used.
	if (existingConfigPath && existingConfigPath !== configPath) {
		rmSync(existingConfigPath);
		logger.info(`Removed the previous configuration at ${highlight(existingConfigPath)}.`);
	}

	if (existsSync(packageJsonPath)) {
		try {
			const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
			packageJson.scripts = {
				...packageJson.scripts,
				'lunaria:build': 'lunaria build',
				'lunaria:preview': 'lunaria preview',
			};

			writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
			logger.info('Added lunaria scripts to your package.json file.');
		} catch {
			logger.error("Failed to update your package.json's scripts.");
		}
	}

	logger.info(`Config created at: ${highlight(configPath)}`);
	logger.info(
		`You're almost done, read your next steps: ${highlight(
			'https://lunaria.dev/getting-started/#next-steps',
		)}`,
	);
	logger.info(bold('Complete!'));
}

/** Prompts for a text value until it passes validation, exiting if the prompt is cancelled. */
async function promptRequiredText(
	logger: ConsolaInstance,
	message: string,
	options: {
		placeholder: string;
		defaultValue?: string;
		validate: (value: string) => string | undefined;
	},
) {
	while (true) {
		const answer: string | undefined = exitOnCancel(
			await logger.prompt(message, {
				type: 'text',
				placeholder: options.placeholder,
				default: options.defaultValue,
				cancel: 'symbol',
			}),
		);
		const value = (answer ?? '').trim();

		const error = options.validate(value);
		if (!error) return value;

		logger.warn(error);
	}
}

function createConfigFile(answers: {
	hosting: GitHostingOptions;
	name: string;
	branch: string;
	rootDir: string | undefined;
}) {
	const repository = [
		`\t\tname: ${JSON.stringify(answers.name)},`,
		// "main" is the default value, can be omitted.
		...(answers.branch !== 'main' ? [`\t\tbranch: ${JSON.stringify(answers.branch)},`] : []),
		...(answers.rootDir ? [`\t\trootDir: ${JSON.stringify(answers.rootDir)},`] : []),
		// "github" is the default value, can be omitted.
		...(answers.hosting !== 'github' ? [`\t\thosting: ${JSON.stringify(answers.hosting)},`] : []),
	];

	return [
		'import { defineConfig } from "@lunariajs/core/config";',
		'',
		'export default defineConfig({',
		'\trepository: {',
		...repository,
		'\t},',
		'\t// Complete your configuration with your source locale, localized locales, and tracked files.',
		'\t// Read the configuration reference: https://lunaria.dev/reference/configuration/',
		'\t//',
		'\t// sourceLocale: { label: "English", lang: "en" },',
		'\t// locales: [{ label: "Português", lang: "pt" }],',
		'\t// files: [',
		'\t// \t{',
		'\t// \t\tinclude: ["src/content/docs/**/*.mdx"],',
		'\t// \t\tpattern: "src/content/docs/@lang/@path",',
		'\t// \t\ttype: "universal",',
		'\t// \t},',
		'\t// ],',
		'});',
		'',
	].join('\n');
}
