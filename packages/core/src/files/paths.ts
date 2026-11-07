import type { LunariaConfig, Pattern } from '../config/types.ts';
import {
	InvalidFilesPattern,
	InvalidPatternSyntax,
	MismatchedPatternParameters,
	PathNotMatched,
} from '../errors/errors.ts';
import {
	compile,
	escapeString,
	type MatchFunction,
	match,
	type PathFunction,
	PatternError,
	parse,
} from './patterns.ts';
import type { PathResolver } from './types.ts';

type PathParams = Record<string | number, unknown>;

interface PreparedPattern {
	pattern: string;
	names: Array<string | number>;
	match: MatchFunction<PathParams>;
	compile: PathFunction<PathParams>;
}

/**
 * Replaces every placeholder in a pattern with its parameter, preferring the longest name (e.g. `@langTag` over `@lang`).
 * Also returns the original index of each character, so errors can point to what the user wrote.
 */
function replacePlaceholders(pattern: string, placeholders: Record<string, string>) {
	const keys = Object.keys(placeholders).sort((a, b) => b.length - a.length);
	const origins: number[] = [];
	let result = '';
	let index = 0;

	while (index < pattern.length) {
		// Escaped characters are copied as-is, so `\@lang` isn't replaced.
		if (pattern.charAt(index) === '\\') {
			const escaped = pattern.slice(index, index + 2);
			result += escaped;
			for (let i = 0; i < escaped.length; i++) origins.push(index + i);
			index += escaped.length;
			continue;
		}

		const key = keys.find((key) => pattern.startsWith(key, index));

		if (key) {
			const replacement = placeholders[key] ?? '';
			result += replacement;
			for (let i = 0; i < replacement.length; i++) origins.push(index);
			index += key.length;
			continue;
		}

		result += pattern.charAt(index);
		origins.push(index);
		index++;
	}

	origins.push(pattern.length);

	return { result, origins };
}

/** Replaces the placeholders of a pattern and parses it once, so it can be reused for every path. */
function preparePattern(
	original: string,
	placeholders: Record<string, string>,
	validNames: string[],
): PreparedPattern {
	const { result: pattern, origins } = replacePlaceholders(original, placeholders);

	try {
		const tokens = parse(pattern);

		const hasValidParameter = tokens.some(
			(token) =>
				typeof token !== 'string' &&
				typeof token.name === 'string' &&
				validNames.includes(token.name),
		);

		if (!hasValidParameter) {
			throw new Error(InvalidFilesPattern.message(original));
		}

		const names = tokens.flatMap((token) => (typeof token === 'string' ? [] : [token.name]));

		return { pattern, names, match: match(tokens), compile: compile(tokens) };
	} catch (error) {
		if (error instanceof PatternError) {
			const index = origins[error.index] ?? original.length;
			throw new Error(InvalidPatternSyntax.message(original, error.reason, String(index)));
		}

		// An invalid regular expression in a parameter, e.g. `:name([a-z)`.
		if (error instanceof SyntaxError) {
			throw new Error(InvalidPatternSyntax.message(original, error.message));
		}

		throw error;
	}
}

/**
 * Returns a couple of functions to match and generate paths from the specified pattern.
 * This is used mostly to dynamically find the paths for localizations based on the source file paths.
 */
export function createPathResolver(
	pattern: Pattern,
	sourceLocale: LunariaConfig['sourceLocale'],
	locales: LunariaConfig['locales'],
): PathResolver {
	/*
	 * We have to change the accepted locales for each pattern, since the source pattern
	 * should only accept the source locale, and the locales pattern should accept all the other locales.
	 */
	// Values are escaped to match literally and sorted so `pt-BR` is tried before `pt`.
	// A single empty value becomes `|`, since a parameter can't have an empty regular expression.
	const valuesPattern = (values: string[]) =>
		[...values]
			.sort((a, b) => b.length - a.length)
			.map(escapeString)
			.join('|') || '|';

	// @lang - Matches the locale part of the path.
	const langPattern = (langs: string[]) => `:lang(${valuesPattern(langs)})`;
	// @path - Matches the rest of the path.
	const pathPattern = ':path(.*)';

	// All locales are assumed to have the same parameters, so for simplicity
	// we use the source pattern's parameters as a reference of all shared parameters.
	const customParameters = sourceLocale.parameters;

	const placeholders = (source: boolean): Record<string, string> => {
		const basePlaceholders = {
			'@lang': langPattern(source ? [sourceLocale.lang] : locales.map((locale) => locale.lang)),
			'@path': pathPattern,
		};

		if (customParameters) {
			// The parameters of every locale are ensured to exist by the validation schema.
			const placeholderValues = (key: string) =>
				(source ? [sourceLocale] : locales).map((locale) => locale.parameters?.[key] ?? '');

			const customPlaceholders = Object.keys(customParameters).reduce(
				(acc, param) => {
					acc[`@${param}`] = `:${param}(${valuesPattern(placeholderValues(param))})`;
					return acc;
				},
				{} as Record<string, string>,
			);

			return {
				...basePlaceholders,
				...customPlaceholders,
			};
		}

		return basePlaceholders;
	};

	// We accept either a single string pattern or one for souce and localized content
	// This is meant to support cases where the path for the source content is
	// different from the localized content.
	const baseSourcePattern = typeof pattern === 'string' ? pattern : pattern.source;
	const baseLocalesPattern = typeof pattern === 'string' ? pattern : pattern.locales;

	/*
	 * Originally, this was a strict check to see if the source pattern had the `@path` parameter
	 * and the locales pattern had the `@lang` and `@path` parameter, which was the assumpting for the way
	 * paths worked in Lunaria pre-v1. However, this is not the case anymore since Lunaria does not care
	 * for having a common path for files anymore, allowing us to have paths like this:
	 * - Source path: `src/i18n/en.yml`
	 * - Locales path: `src/i18n/pt-BR.yml`
	 * - Pattern: `src/i18n/@tag.yml`
	 */
	const validNames = ['lang', 'path', ...(customParameters ? Object.keys(customParameters) : [])];

	const source = preparePattern(baseSourcePattern, placeholders(true), validNames);
	const localized = preparePattern(baseLocalesPattern, placeholders(false), validNames);

	// Paths are built from the values matched by the other pattern, so both need the same parameters,
	// except for `lang` and custom parameters, which come from the target locale's configuration.
	if (typeof pattern !== 'string') {
		const fromConfig = new Set<string | number>(['lang', ...Object.keys(customParameters ?? {})]);
		const sourceOnly = source.names.find(
			(name) => !fromConfig.has(name) && !localized.names.includes(name),
		);
		const localesOnly = localized.names.find(
			(name) => !fromConfig.has(name) && !source.names.includes(name),
		);
		const mismatch = sourceOnly ?? localesOnly;

		if (mismatch !== undefined) {
			const parameter =
				typeof mismatch === 'string' ? `\`:${mismatch}\`` : `unnamed parameter ${mismatch + 1}`;
			throw new Error(
				MismatchedPatternParameters.message(
					pattern.source,
					pattern.locales,
					parameter,
					sourceOnly !== undefined ? 'source' : 'locales',
				),
			);
		}
	}

	return {
		/*
		 * Explanation: why does `isSourcePath` checks if it isn't a locales path but `isLocalesPath` doesn't?
		 * In a few cases, the source path can end up matching the locales path, like so:
		 *
		 * - Source path: `docs/test.mdx` (sourcePattern: `docs/@path`)
		 * - Locales path: `docs/en/test.mdx` (localesPattern: `docs/@lang/@path`)
		 *
		 * In this case, the locales path fulfills the source pattern match, but the opposite can't happen, considering
		 * the locales path strictly requires the `@lang` parameter that is limited to the configured locales.
		 */
		// `match` returns an object if true, here we're forcing it to return a boolean.
		isSourcePath: (path: string) => !!source.match(path) && !localized.match(path),
		isLocalesPath: (path: string) => !!localized.match(path),
		toPath: (fromPath: string, toLang: string) => {
			const fromMatch = localized.match(fromPath) || source.match(fromPath);

			if (!fromMatch) {
				const displayPattern =
					typeof pattern === 'string'
						? pattern
						: `${pattern.source} (source) - ${pattern.locales} (locales)`;
				throw new Error(PathNotMatched.message(fromPath, displayPattern));
			}

			// Since the path for the same source and localized content can have different patterns,
			// we have to check if the `toLang` is from the sourceLocale (i.e. source content) or
			// from the localized content, meaning we get the correct path always.
			const target = locales.map((locale) => locale.lang).includes(toLang) ? localized : source;

			// We inject the custom parameters as-is for the target locale.
			const localeParameters = [sourceLocale, ...locales].find(
				(locale) => locale.lang === toLang,
			)?.parameters;

			return target.compile({
				// We extract and inject any parameters that could be found
				// from the initial path to the resulting path, this is what
				// enables the path inferring.
				...fromMatch.params,
				// Locale parameters are injected as-is from the locale's `parameters` field,
				// if the pattern needs any of those parameters, it will have the values needed.
				...localeParameters,
				// The lang has to be given last since it could be overwritten by the initial path's
				// parameters, which we don't want to happen.
				lang: toLang,
			});
		},
		sourcePattern: source.pattern,
		localesPattern: localized.pattern,
	};
}
