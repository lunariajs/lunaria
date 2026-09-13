import { createConsola } from 'consola';
import { colors } from 'consola/utils';

export const logger = createConsola({
	formatOptions: {
		date: false,
	},
});

/** Creates a logger that prefixes all messages with the command's name. */
export function createCommandLogger(command: string) {
	return logger.withTag(command);
}

export function highlight(message: string) {
	return colors.blue(message);
}

export function bold(message: string) {
	return colors.bold(message);
}

export function dim(message: string) {
	return colors.dim(message);
}

export function code(message: string) {
	return colors.italic(colors.white(message));
}

export function failure(message: string) {
	return colors.red(`✕ ${message}`);
}

/** Exits the process when a prompt was cancelled (e.g. by pressing Ctrl+C), otherwise returns its value. */
export function exitOnCancel<T>(value: T | undefined): T {
	if (value === undefined) {
		logger.log(failure('Operation cancelled.'));
		process.exit(0);
	}

	return value;
}
