import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { join as joinPOSIX } from 'node:path/posix';
import type { z } from 'zod';
import type { LunariaConfig } from '../config/types.js';
import { errorMap } from '../errors/zod-map.js';

export function isRelative(path: string) {
	return path.startsWith('./') || path.startsWith('../');
}

export function stripTrailingSlash(path: string) {
	return path.replace(/\/+$/, '');
}

export function md5(content: string) {
	return createHash('md5').update(content).digest('hex').slice(0, 8);
}

export function stringFromFormat(format: string, placeholders: Record<string, string>) {
	let formatResult = format;
	for (const key of Object.keys(placeholders) as Array<keyof typeof placeholders>) {
		formatResult = formatResult.replace(key, placeholders[key] ?? '');
	}
	return formatResult;
}

export function parseWithFriendlyErrors<T extends z.Schema>(
	schema: T,
	input: z.input<T>,
	message: (issues: string) => string,
): z.output<T> {
	const parsedConfig = schema.safeParse(input, { errorMap });

	if (!parsedConfig.success) {
		const issues = parsedConfig.error.issues.map((i) => `- ${i.message}`).join('\n');
		throw new Error(message(issues));
	}

	return parsedConfig.data;
}

export async function exists(path: string) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

export async function createCache(dir: string, entry: string, hash: string) {
	const file = `${entry}.json`;
	const path = resolve(join(dir, file));

	const write = async (contents: Record<string, string>) => {
		await writeFile(
			path,
			JSON.stringify({
				__validation: hash,
				...contents,
			}),
		);
	};

	const contents = async () => {
		const file = await readFile(path, 'utf-8');
		return JSON.parse(file);
	};

	const revalidate = async (hash: string) => {
		if ((await contents())?.__validation !== hash) {
			await write({});
		}
	};

	if (!(await exists(path))) {
		await mkdir(resolve(dir), { recursive: true });
		await write({ __validation: hash });
	} else {
		await revalidate(hash);
	}

	return { contents, write };
}

export function createGitHostingLinks(repository: LunariaConfig['repository']) {
	const { name, branch, hosting, rootDir } = repository;
	const github = 'github.com';
	const gitlab = 'gitlab.com';
	// We use the POSIX version of `join` to ensure the URLs match what is expected
	// of the browser.
	switch (hosting) {
		case 'github':
			return {
				create: (path: string) =>
					`https://${joinPOSIX(github, name, 'new', `${branch}?filename=${joinPOSIX(rootDir, path)}`)}`,
				source: (path: string) =>
					`https://${joinPOSIX(github, name, 'blob', branch, rootDir, path)}`,
				history: (path: string, since?: string) =>
					`https://${joinPOSIX(github, name, 'commits', branch, rootDir, `${path}${since ? `?since=${since}` : ''}`)}`,
				clone: () => `https://${joinPOSIX(github, name)}.git`,
			};

		case 'gitlab':
			return {
				create: (path: string) =>
					`https://${joinPOSIX(gitlab, name, '-', 'new', `${branch}?file_name=${joinPOSIX(rootDir, path)}`)}`,
				source: (path: string) =>
					`https://${joinPOSIX(gitlab, name, '-', 'blob', branch, rootDir, path)}`,
				history: (path: string, since?: string) =>
					`https://${joinPOSIX(gitlab, name, '-', 'commits', branch, rootDir, `${path}${since ? `?since=${since}` : ''}`)}`,
				clone: () => `https://${joinPOSIX(gitlab, name)}.git`,
			};
	}
}
