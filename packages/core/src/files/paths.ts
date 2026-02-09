import { compile, type MatchResult, match } from 'path-to-regexp';
import type { LunariaConfig, Pattern } from '../config/types.ts';
import { InvalidFilesPattern } from '../errors/errors.ts';
import { stringFromFormat } from '../utils/utils.ts';
import type { PathResolver } from './types.ts';

/** Returns if a pattern has parameters or not */
function hasParameters(pattern: string, parameters: string[]) {
	return parameters.some((parameter) => pattern.includes(parameter));
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
	const joinedLocales = locales.map((locale) => locale.lang).join('|');

	// @lang - Matches the locale part of the path.
	const langPattern = (locales: string) => `:lang(${locales})`;
	// @path - Matches the rest of the path.
	const pathPattern = ':path(.*)';

	// All locales are assumed to have the same parameters, so for simplicity
	// we use the source pattern's parameters as a reference of all shared parameters.
	const customParameters = sourceLocale.parameters;

	const placeholders = (source: boolean): Record<string, string> => {
		const basePlaceholders = {
			'@lang': langPattern(source ? sourceLocale.lang : joinedLocales),
			'@path': pathPattern,
		};

		if (customParameters) {
			const placeholderValue = (key: string) => {
				// biome-ignore lint/style/noNonNullAssertion: These are ensured to exist by the validation schema.
				const sourceParameterValue = sourceLocale.parameters![key];
				// biome-ignore lint/style/noNonNullAssertion: see above
				const localeParameterValue = locales.map((locale) => locale.parameters![key]).join('|');
				return source ? sourceParameterValue : localeParameterValue;
			};

			const customPlaceholders = Object.keys(customParameters).reduce(
				(acc, param) => {
					acc[`@${param}`] = `:${param}(${placeholderValue(param)})`;
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

	const sourcePattern = stringFromFormat(baseSourcePattern, placeholders(true));
	const localesPattern = stringFromFormat(baseLocalesPattern, placeholders(false));

	/*
	 * Originally, this was a strict check to see if the source pattern had the `@path` parameter
	 * and the locales pattern had the `@lang` and `@path` parameter, which was the assumpting for the way
	 * paths worked in Lunaria pre-v1. However, this is not the case anymore since Lunaria does not care
	 * for having a common path for files anymore, allowing us to have paths like this:
	 * - Source path: `src/i18n/en.yml`
	 * - Locales path: `src/i18n/pt-BR.yml`
	 * - Pattern: `src/i18n/@tag.yml`
	 */
	const validParameters = [
		':lang',
		':path',
		...(customParameters ? Object.keys(customParameters).map((param) => `:${param}`) : []),
	];

	if (!hasParameters(sourcePattern, validParameters)) {
		throw new Error(InvalidFilesPattern.message(baseSourcePattern));
	}

	if (!hasParameters(localesPattern, validParameters)) {
		throw new Error(InvalidFilesPattern.message(baseLocalesPattern));
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
		isSourcePath: (path: string) => !!match(sourcePattern)(path) && !match(localesPattern)(path),
		isLocalesPath: (path: string) => !!match(localesPattern)(path),
		toPath: (fromPath: string, toLang: string) => {
			// Since the path for the same source and localized content can have different patterns,
			// we have to check if the `toLang` is from the sourceLocale (i.e. source content) or
			// from the localized content, meaning we get the correct path always.
			const selectedPattern = locales.map((locale) => locale.lang).includes(toLang)
				? localesPattern
				: sourcePattern;
			const inverseSelectedPattern =
				selectedPattern === sourcePattern ? localesPattern : sourcePattern;

			// We inject the custom parameters as-is for the target locale.
			const localeParameters = [sourceLocale, ...locales].find(
				(locale) => locale.lang === toLang,
			)?.parameters;

			// TODO: Explore edge case where the fromPath is from the same locale as `toLang`,
			// which causes an unexpected issue that makes it select the incorrect pattern.
			const matcher = match(inverseSelectedPattern) as (
				path: string,
			) => MatchResult<{ lang?: string; path: string }>;

			return compile<{ lang?: string; path: string }>(selectedPattern)({
				// We extract and inject any parameters that could be found
				// from the initial path to the resulting path, this is what
				// enables the path inferring.
				...matcher(fromPath).params,
				// Locale parameters are injected as-is from the locale's `parameters` field,
				// if the pattern needs any of those parameters, it will have the values needed.
				...localeParameters,
				// The lang has to be given last since it could be overwritten by the initial path's
				// parameters, which we don't want to happen.
				lang: toLang,
			});
		},
		sourcePattern: sourcePattern,
		localesPattern: localesPattern,
	};
}
