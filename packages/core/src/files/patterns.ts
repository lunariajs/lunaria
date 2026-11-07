/**
 * A port of the parts of `path-to-regexp` v6.3.0 used by Lunaria, since newer versions removed
 * the syntax our patterns rely on. It matches file paths instead of URLs, and rejects the patterns
 * that can't build correct paths for other locales.
 *
 * Based on https://github.com/pillarjs/path-to-regexp/tree/v6.3.0
 * Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com) — MIT License.
 */

const PREFIXES = './';
const DELIMITER = '/';

/** A parameter found in a pattern. */
export interface Key {
	name: string | number;
	prefix: string;
	suffix: string;
	pattern: string;
	modifier: string;
}

export type Token = string | Key;

export interface MatchResult<P extends object = object> {
	path: string;
	index: number;
	params: P;
}

export type Match<P extends object = object> = false | MatchResult<P>;

export type MatchFunction<P extends object = object> = (path: string) => Match<P>;
export type PathFunction<P extends object = object> = (data?: P) => string;

/** An invalid pattern, with the index where the problem was found. */
export class PatternError extends TypeError {
	readonly reason: string;
	readonly index: number;

	constructor(reason: string, index: number) {
		super(`${reason} at position ${index}`);
		this.name = 'PatternError';
		this.reason = reason;
		this.index = index;
	}
}

interface LexToken {
	type: 'OPEN' | 'CLOSE' | 'PATTERN' | 'NAME' | 'CHAR' | 'ESCAPED_CHAR' | 'MODIFIER' | 'END';
	index: number;
	value: string;
}

/** Escapes a string so it can be used literally inside a regular expression. */
export function escapeString(str: string) {
	return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1');
}

/** Returns if a group in a parameter's regular expression captures (including named groups), is a lookbehind, or neither. */
function groupKind(str: string, index: number): 'capturing' | 'lookbehind' | 'other' {
	if (str.charAt(index + 1) !== '?') return 'capturing';
	if (str.charAt(index + 2) !== '<') return 'other';
	const next = str.charAt(index + 3);
	return next === '=' || next === '!' ? 'lookbehind' : 'capturing';
}

/** Tokenizes the pattern string. */
function lexer(str: string): LexToken[] {
	const tokens: LexToken[] = [];
	let i = 0;

	while (i < str.length) {
		const char = str.charAt(i);

		if (char === '*' || char === '+' || char === '?') {
			tokens.push({ type: 'MODIFIER', index: i, value: char });
			i++;
			continue;
		}

		if (char === '\\') {
			if (i + 1 >= str.length) {
				throw new PatternError('Missing character to escape after "\\"', i);
			}
			tokens.push({ type: 'ESCAPED_CHAR', index: i, value: str.charAt(i + 1) });
			i += 2;
			continue;
		}

		if (char === '{') {
			tokens.push({ type: 'OPEN', index: i, value: char });
			i++;
			continue;
		}

		if (char === '}') {
			tokens.push({ type: 'CLOSE', index: i, value: char });
			i++;
			continue;
		}

		if (char === ':') {
			let name = '';
			let j = i + 1;

			while (j < str.length && /[A-Za-z0-9_]/.test(str.charAt(j))) {
				name += str.charAt(j);
				j++;
			}

			if (!name) {
				throw new PatternError('Missing parameter name after ":"', i);
			}

			tokens.push({ type: 'NAME', index: i, value: name });
			i = j;
			continue;
		}

		if (char === '(') {
			let count = 1;
			let pattern = '';
			let j = i + 1;

			if (str.charAt(j) === '?') {
				throw new PatternError('Regular expression cannot start with "?"', j);
			}

			while (j < str.length) {
				if (str.charAt(j) === '\\') {
					pattern += str.charAt(j) + str.charAt(j + 1);
					j += 2;
					continue;
				}

				if (str.charAt(j) === ')') {
					count--;
					if (count === 0) {
						j++;
						break;
					}
				} else if (str.charAt(j) === '(') {
					count++;
					const kind = groupKind(str, j);
					if (kind === 'capturing') {
						throw new PatternError(
							'Capturing groups are not allowed, use a non-capturing group "(?:...)" instead',
							j,
						);
					}
					// Values are checked on their own when building paths, so lookbehinds would always fail.
					if (kind === 'lookbehind') {
						throw new PatternError('Lookbehinds are not allowed', j);
					}
				}

				pattern += str.charAt(j);
				j++;
			}

			if (count) throw new PatternError('Unbalanced parentheses', i);
			if (!pattern) throw new PatternError('Missing regular expression between parentheses', i);

			tokens.push({ type: 'PATTERN', index: i, value: pattern });
			i = j;
			continue;
		}

		tokens.push({ type: 'CHAR', index: i, value: char });
		i++;
	}

	tokens.push({ type: 'END', index: i, value: '' });

	return tokens;
}

/** Returns how a token was written in the pattern, for error messages. */
function displayToken(token: LexToken) {
	if (token.type === 'NAME') return `:${token.value}`;
	if (token.type === 'PATTERN') return `(${token.value})`;
	if (token.type === 'ESCAPED_CHAR') return `\\${token.value}`;
	return token.value;
}

/** Parses a pattern string into its tokens. */
export function parse(str: string): Token[] {
	const tokens = lexer(str);
	const result: Token[] = [];
	let key = 0;
	let i = 0;
	let path = '';

	const tryConsume = (type: LexToken['type']): string | undefined => {
		const token = tokens[i];
		if (token && token.type === type) {
			i++;
			return token.value;
		}
		return undefined;
	};

	const nextIndex = () => tokens[i]?.index ?? str.length;

	const consumeText = (): string => {
		let text = '';
		while (true) {
			const value = tryConsume('CHAR') || tryConsume('ESCAPED_CHAR');
			if (!value) return text;
			text += value;
		}
	};

	const safePattern = (prefix: string, index: number) => {
		const prev = result[result.length - 1];
		const prevText = prefix || (typeof prev === 'string' ? prev : '');

		if (typeof prev === 'object' && !prevText) {
			throw new PatternError(
				`Missing text between the parameter "${prev.name}" and the next one`,
				index,
			);
		}

		if (!prevText || prevText.includes(DELIMITER)) return `[^${escapeString(DELIMITER)}]+?`;
		return `(?:(?!${escapeString(prevText)})[^${escapeString(DELIMITER)}])+?`;
	};

	const pushKey = (token: Key, index: number) => {
		if ((token.modifier === '+' || token.modifier === '*') && !token.prefix && !token.suffix) {
			throw new PatternError(
				`Cannot repeat the parameter "${token.name}" without a prefix or suffix to separate each repetition`,
				index,
			);
		}

		result.push(token);
	};

	while (i < tokens.length) {
		const char = tryConsume('CHAR');
		const paramIndex = nextIndex();
		const name = tryConsume('NAME');
		const pattern = tryConsume('PATTERN');

		if (name || pattern) {
			let prefix = char || '';

			if (!PREFIXES.includes(prefix)) {
				path += prefix;
				prefix = '';
			}

			if (path) {
				result.push(path);
				path = '';
			}

			pushKey(
				{
					name: name || key++,
					prefix,
					suffix: '',
					pattern: pattern || safePattern(prefix, paramIndex),
					modifier: tryConsume('MODIFIER') || '',
				},
				paramIndex,
			);
			continue;
		}

		const value = char || tryConsume('ESCAPED_CHAR');
		if (value) {
			path += value;
			continue;
		}

		if (path) {
			result.push(path);
			path = '';
		}

		const openIndex = nextIndex();
		if (tryConsume('OPEN')) {
			const prefix = consumeText();
			const groupParamIndex = nextIndex();
			const name = tryConsume('NAME') || '';
			const pattern = tryConsume('PATTERN') || '';
			const suffix = consumeText();

			const close = tokens[i];
			if (!close || close.type === 'END') {
				throw new PatternError('Missing "}" to close the group', openIndex);
			}
			if (close.type !== 'CLOSE') {
				throw new PatternError(
					`Unexpected "${displayToken(close)}" in a group, which can only contain a prefix, one parameter, and a suffix`,
					close.index,
				);
			}
			i++;

			if (!name && !pattern) {
				throw new PatternError('Groups must contain a parameter', openIndex);
			}

			pushKey(
				{
					name: name || key++,
					pattern: name && !pattern ? safePattern(prefix, groupParamIndex) : pattern,
					prefix,
					suffix,
					modifier: tryConsume('MODIFIER') || '',
				},
				groupParamIndex,
			);
			continue;
		}

		const token = tokens[i];
		if (!token || token.type === 'END') {
			i++;
			continue;
		}

		// Only modifiers and stray closing braces can be left here.
		throw new PatternError(
			`Unexpected "${displayToken(token)}", escape it with a backslash to match it literally`,
			token.index,
		);
	}

	return result;
}

/** Transforms tokens into a regular expression, collecting the parameters found into `keys`. */
function tokensToRegexp(tokens: Token[], keys: Key[]): RegExp {
	let route = '^';

	for (const token of tokens) {
		if (typeof token === 'string') {
			route += escapeString(token);
			continue;
		}

		keys.push(token);

		const prefix = escapeString(token.prefix);
		const suffix = escapeString(token.suffix);

		if (prefix || suffix) {
			if (token.modifier === '+' || token.modifier === '*') {
				const mod = token.modifier === '*' ? '?' : '';
				route += `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
			} else {
				route += `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
			}
			continue;
		}

		route += `(${token.pattern})${token.modifier}`;
	}

	route += '$';

	return new RegExp(route);
}

/** Creates a function that returns the parameters of a path matching the pattern, or `false` if it doesn't match. */
export function match<P extends object = object>(str: string | Token[]): MatchFunction<P> {
	const keys: Key[] = [];
	const regexp = tokensToRegexp(typeof str === 'string' ? parse(str) : str, keys);

	return (path: string) => {
		const result = regexp.exec(path);
		if (!result) return false;

		const params: Record<string | number, string | string[]> = Object.create(null);

		keys.forEach((key, index) => {
			const value = result[index + 1];
			if (value === undefined) return;

			// Repeated values are matched as `value(suffix + prefix + value)*`, so that's the separator.
			params[key.name] =
				key.modifier === '*' || key.modifier === '+' ? value.split(key.suffix + key.prefix) : value;
		});

		return { path: result[0], index: result.index, params: params as P };
	};
}

/** Creates a function that builds a path from the pattern, filling in its parameters with the given data. */
export function compile<P extends object = object>(str: string | Token[]): PathFunction<P> {
	const tokens = (typeof str === 'string' ? parse(str) : str).map((token) =>
		typeof token === 'string'
			? token
			: { key: token, regexp: new RegExp(`^(?:${token.pattern})$`) },
	);

	return (data?: P) => {
		let path = '';

		for (const token of tokens) {
			if (typeof token === 'string') {
				path += token;
				continue;
			}

			const { key, regexp } = token;
			const value = data ? (data as Record<string | number, unknown>)[key.name] : undefined;
			const optional = key.modifier === '?' || key.modifier === '*';
			const repeat = key.modifier === '*' || key.modifier === '+';

			if (Array.isArray(value)) {
				if (!repeat) {
					throw new TypeError(`Expected "${key.name}" to not repeat, but got an array`);
				}

				if (value.length === 0) {
					if (optional) continue;
					throw new TypeError(`Expected "${key.name}" to not be empty`);
				}

				for (const item of value) {
					const segment = String(item);

					if (!regexp.test(segment)) {
						throw new TypeError(
							`Expected all "${key.name}" to match "${key.pattern}", but got "${segment}"`,
						);
					}

					path += key.prefix + segment + key.suffix;
				}
				continue;
			}

			if (typeof value === 'string' || typeof value === 'number') {
				const segment = String(value);

				if (!regexp.test(segment)) {
					throw new TypeError(
						`Expected "${key.name}" to match "${key.pattern}", but got "${segment}"`,
					);
				}

				path += key.prefix + segment + key.suffix;
				continue;
			}

			if (optional) continue;

			throw new TypeError(`Expected "${key.name}" to be ${repeat ? 'an array' : 'a string'}`);
		}

		return path;
	};
}
