import { colors } from 'consola/utils';
import { logger } from '../console.ts';
import type { CLI } from '../types.ts';

export function help(cli: CLI, command?: string) {
	const output = [];

	const linebreak = () => '';
	const title = (label: string) => ` ${colors.bgYellow(colors.black(` ${label} `))} `;

	const existingCommand = cli.commands.find((cmd) => cmd.name === command);

	if (existingCommand) {
		const { name, usage } = existingCommand;

		output.push(linebreak(), `  ${colors.magenta(`lunaria ${name}`)} ${colors.bold(usage)}`);

		const optionEntries: Array<[string, string]> | undefined = existingCommand.options?.map(
			(opt) => [opt.name, opt.description],
		);

		if (optionEntries) {
			const padding = calculateTablePadding(optionEntries);

			output.push(linebreak(), title('Options'), linebreak(), table(optionEntries, { padding }));
		}

		output.push(linebreak(), `  ${existingCommand.description}`);
	} else {
		output.push(
			linebreak(),
			` ${colors.bgYellow(colors.black(' Lunaria '))} Supercharge your localization workflow.`,
		);

		output.push(
			linebreak(),
			`   ${colors.magenta('lunaria')} ${colors.bold('[command] [...options]')}`,
		);

		const commandEntries: Array<[string, string]> = cli.commands.map((command) => [
			command.name,
			command.description,
		]);

		const optionEntries: Array<[string, string]> = cli.options.map((option) => [
			option.name,
			option.description,
		]);

		const tableEntries = [commandEntries, optionEntries];
		const padding = Math.max(...tableEntries.map((rows) => calculateTablePadding(rows)));

		output.push(linebreak(), title('Commands'), linebreak(), table(commandEntries, { padding }));
		output.push(
			linebreak(),
			title('Global Options'),
			linebreak(),
			table(optionEntries, { padding }),
		);
	}

	logger.log(`${output.join('\n')}\n`);
}

function calculateTablePadding(rows: [string, string][]) {
	return rows.reduce((val, [first]) => Math.max(val, first.length), 0) + 2;
}

function table(rows: [string, string][], { padding }: { padding: number }) {
	const split = process.stdout.columns < 60;
	let raw = '';

	for (const row of rows) {
		if (split) {
			raw += `    ${row[0]}\n    `;
		} else {
			raw += `${row[0]}`.padStart(padding);
		}
		raw += `  ${colors.dim(row[1])}\n`;
	}

	return raw.slice(0, -1); // Remove latest \n
}
