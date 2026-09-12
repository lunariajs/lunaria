/**
 * This is a modified version of Starlight's error map (which itself is a modified version of Astro's).
 * Source: https://github.com/withastro/starlight/blob/main/packages/starlight/utils/error-map.ts
 */

import type { z } from 'zod';

type TypeOrLiteralErrByPathEntry = {
	code: 'invalid_type' | 'invalid_literal';
	received: unknown;
	expected: unknown[];
};

export const errorMap: z.ZodErrorMap = (baseError, ctx) => {
	const baseErrorPath = flattenErrorPath(baseError.path);

	if (baseError.code === 'invalid_union') {
		// Optimization: Combine type and literal errors for keys that are common across ALL union types
		// Ex. a union between `{ type: z.literal('universal') }` and `{ type: z.literal('dictionary') }` will
		// raise a single error when `type` does not match:
		// > Did not match union.
		// > key: Expected `'universal' | 'dictionary'`, received 'foo'
		const typeOrLiteralErrByPath: Map<string, TypeOrLiteralErrByPathEntry> = new Map();
		for (const unionError of baseError.unionErrors.flatMap((e) => e.errors)) {
			if (unionError.code === 'invalid_type' || unionError.code === 'invalid_literal') {
				const flattenedErrorPath = flattenErrorPath(unionError.path);
				if (typeOrLiteralErrByPath.has(flattenedErrorPath)) {
					typeOrLiteralErrByPath.get(flattenedErrorPath)?.expected.push(unionError.expected);
				} else {
					typeOrLiteralErrByPath.set(flattenedErrorPath, {
						code: unionError.code,
						received: unionError.received,
						expected: [unionError.expected],
					});
				}
			}
		}
		const messages: string[] = [prefix(baseErrorPath, 'Did not match union.')];
		const details: string[] = [...typeOrLiteralErrByPath.entries()]
			// If type or literal error isn't common to ALL union types,
			// filter it out. Can lead to confusing noise.
			.filter(([, error]) => error.expected.length === baseError.unionErrors.length)
			.map(([key, error]) =>
				key === baseErrorPath
					? // Avoid printing the key again if it's a base error.
						`> ${getTypeOrLiteralMsg(error)}`
					: `> ${prefix(key, getTypeOrLiteralMsg(error))}`,
			);

		if (details.length === 0) {
			const expectedShapes: string[] = [];
			for (const unionError of baseError.unionErrors) {
				const expectedShape: string[] = [];
				for (const issue of unionError.issues) {
					// If the issue is a nested union error, show the associated error message instead of the
					// base error message.
					if (issue.code === 'invalid_union') {
						return errorMap(issue, ctx);
					}
					const relativePath = flattenErrorPath(issue.path)
						.replace(baseErrorPath, '')
						.replace(leadingPeriod, '');
					if ('expected' in issue && typeof issue.expected === 'string') {
						expectedShape.push(
							relativePath ? `${relativePath}: ${issue.expected}` : issue.expected,
						);
					} else {
						expectedShape.push(relativePath);
					}
				}
				expectedShapes.push(`{ ${expectedShape.join('; ')} }`);
			}
			if (expectedShapes.length) {
				details.push(`> Expected type \`${expectedShapes.join(' | ')}\``);
				details.push(`> Received \`${stringify(ctx.data)}\``);
			}
		}

		return {
			message: messages.concat(details).join('\n'),
		};
	}

	if (baseError.code === 'invalid_literal' || baseError.code === 'invalid_type') {
		return {
			message: prefix(
				baseErrorPath,
				getTypeOrLiteralMsg({
					code: baseError.code,
					received: baseError.received,
					expected: [baseError.expected],
				}),
			),
		};
	}

	if (baseError.message) {
		return { message: prefix(baseErrorPath, baseError.message) };
	}

	return { message: prefix(baseErrorPath, ctx.defaultError) };
};

const getTypeOrLiteralMsg = (error: TypeOrLiteralErrByPathEntry): string => {
	if (error.received === 'undefined') return 'Required';
	const expectedDeduped = new Set(error.expected);
	switch (error.code) {
		case 'invalid_type':
			return `Expected type \`${unionExpectedVals(expectedDeduped)}\`, received \`${stringify(
				error.received,
			)}\``;
		case 'invalid_literal':
			return `Expected \`${unionExpectedVals(expectedDeduped)}\`, received \`${stringify(
				error.received,
			)}\``;
	}
};

const prefix = (key: string, msg: string) => (key.length ? `${key}: ${msg}` : msg);

const unionExpectedVals = (expectedVals: Set<unknown>) =>
	[...expectedVals].map((expectedVal) => stringify(expectedVal)).join(' | ');

const flattenErrorPath = (errorPath: (string | number)[]) => errorPath.join('.');

/** `JSON.stringify()` a value with spaces around object/array entries. */
const stringify = (val: unknown) =>
	JSON.stringify(val, null, 1).split(newlinePlusWhitespace).join(' ');
const newlinePlusWhitespace = /\n\s*/;
const leadingPeriod = /^\./;
