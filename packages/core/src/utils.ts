import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { error, highlight } from './cli/console.js';

export function toUtcString(date: string) {
	return new Date(date).toISOString();
}

export function getStringFromFormat(
	format: string,
	placeholders: {
		[part: string]: string;
	}
) {
	return Object.keys(placeholders).reduce((acc, key) => {
		const value = placeholders[key] ?? '';
		return acc.replace(key, value);
	}, format);
}

export function loadWithJiti(path: string) {
	const require = createRequire(import.meta.url);
	const jiti = require('jiti');

	const loadFile = jiti(process.cwd(), {
		interopDefault: true,
		esmResolve: true,
	});

	try {
		const resolvedPath = resolve(path);
		const file = loadFile(resolvedPath);

		return file;
	} catch (e) {
		console.error(error(`Failed to load module at ${highlight(path)}\n`));
		throw e;
	}
}

export function isRelative(path: string) {
	return path.startsWith('./') || path.startsWith('../');
}

export function removeTrailingSlash(path: string) {
	return path.replace(/\/+$/, '');
}
