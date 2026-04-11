import { resolve } from 'node:path';
import { po } from 'gettext-parser';
import { createJiti } from 'jiti';
import yaml from 'js-yaml';
import { Traverse } from 'neotraverse/modern';
import type { OptionalKeys } from '../config/types.ts';
import { InvalidDictionaryStructure, UnsupportedDictionaryFileFormat } from '../errors/errors.ts';
import { DictionarySchema } from './schema.ts';
import type { Dictionary, KeyPath } from './types.ts';

export async function getMissingDictionaryKeys(
	sourceDictionary: { fsPath: string; contents: string },
	localeDictionary: { fsPath: string; contents: string },
	baseDictionaries?: { fsPath: string; contents: string }[],
	optionalKeys?: OptionalKeys,
) {
	const sourceDict = await loadDictionary(sourceDictionary.fsPath, sourceDictionary.contents);
	const localeDict = await loadDictionary(localeDictionary.fsPath, localeDictionary.contents);

	const parsedSourceDict = DictionarySchema.safeParse(sourceDict);
	if (parsedSourceDict.error) {
		throw new Error(InvalidDictionaryStructure.message(sourceDictionary.fsPath));
	}

	const parsedLocaleDict = DictionarySchema.safeParse(localeDict);
	if (parsedLocaleDict.error) {
		throw new Error(InvalidDictionaryStructure.message(localeDictionary.fsPath));
	}

	const effectiveLocaleDict =
		baseDictionaries && baseDictionaries.length > 0
			? mergeBaseDictionaries(
					parsedLocaleDict.data,
					await Promise.all(
						baseDictionaries.map(async (base) => {
							const baseDict = await loadDictionary(base.fsPath, base.contents);
							const parsedBaseDict = DictionarySchema.safeParse(baseDict);

							if (parsedBaseDict.error) {
								throw new Error(InvalidDictionaryStructure.message(base.fsPath));
							}

							return parsedBaseDict.data;
						}),
					),
				)
			: parsedLocaleDict.data;

	return findMissingKeys(optionalKeys, parsedSourceDict.data, effectiveLocaleDict);
}

/**
 * Builds an effective locale dictionary by merging base dictionaries into the locale dictionary.
 * The locale's own keys always take precedence; base dictionaries (in order) fill in the rest.
 * Each base dictionary fills gaps not covered by the locale or by earlier base dictionaries.
 *
 * Used to implement the `merge` field on dictionary file entries, where keys present in a base
 * locale's `lang` count as covered for the target locale. A key is only considered missing if it
 * is absent from the target locale **and** from every base locale in the list.
 *
 * @example
 * // Keys present in `es` are treated as already covered for `es-419`:
 * merge: { 'es-419': ['es'] }
 */
export function mergeBaseDictionaries(localeDict: Dictionary, baseDicts: Dictionary[]): Dictionary {
	return baseDicts.reduce<Dictionary>((acc, base) => deepMergeUnder(acc, base), { ...localeDict });
}

/**
 * Deep-merges `base` into `target`, adding only keys absent from `target`.
 * Keys already present in `target` (at any depth) are never overwritten.
 */
function deepMergeUnder(target: Dictionary, base: Dictionary): Dictionary {
	const result: Dictionary = { ...target };

	for (const key of Object.keys(base)) {
		const baseVal = base[key];
		const targetVal = target[key];

		if (!(key in target) && baseVal !== undefined) {
			// Key entirely absent from target — take from base.
			result[key] = baseVal;
		} else if (
			typeof targetVal === 'object' &&
			targetVal !== null &&
			typeof baseVal === 'object' &&
			baseVal !== null
		) {
			// Both are nested dicts — recurse.
			result[key] = deepMergeUnder(targetVal, baseVal);
		}
		// Otherwise target already has a string value — leave it.
	}

	return result;
}

export function findMissingKeys(
	optionalKeys: OptionalKeys | undefined,
	sourceDict: Dictionary,
	localeDict: Dictionary,
) {
	// In case there's no optional keys, we make it so that the traverse object is empty instead of undefined.
	const optionalKeysTraverse = new Traverse(optionalKeys ?? {});
	const sourceDictTraverse = new Traverse(sourceDict);
	const localeDictTraverse = new Traverse(localeDict);

	const hasOptionalParent = (path: KeyPath) => {
		// is upmost parent
		if (path.length === 1) return optionalKeysTraverse.get(path) === true;

		// not upmost parent
		if (optionalKeysTraverse.get(path) === true) return true;

		// check if parent of parent is optional
		return hasOptionalParent([...path].slice(0, -1));
	};

	const missingKeys = (sourceDictTraverse.paths() as KeyPath[])
		.map((path) => {
			// Ignore non-leafs
			if (typeof sourceDictTraverse.get(path) === 'object') return undefined;
			// Key is missing
			if (!localeDictTraverse.has(path)) {
				// but parent is optional
				if (path.length > 1 && hasOptionalParent(path)) return undefined;
				// but leaf is optional
				if (optionalKeysTraverse.get(path) === true) return undefined;
				// and is NOT optional
				return path;
			}
			// Key is not missing
			return undefined;
		})
		.filter((key) => key !== undefined);

	return missingKeys;
}

// TODO: Add integration tests for this function
export async function loadDictionary(path: string, contents: string) {
	/** Regex to match ESM and CJS JavaScript/TypeScript files. */
	if (/\.(c|m)?(ts|js)$/.test(path)) {
		const resolvedPath = resolve(path);
		const jiti = createJiti(import.meta.url);

		return await jiti.import(resolvedPath, { default: true });
	}

	/** Regex to match YAML files. */
	if (/\.(yml|yaml)$/.test(path)) {
		return yaml.load(contents);
	}

	/** Regex to match JSON files. */
	if (/\.json$/.test(path)) {
		return JSON.parse(contents);
	}

	if (/\.pot?$/.test(path)) {
		return parsePoFile(contents, path);
	}

	throw new Error(UnsupportedDictionaryFileFormat.message(path));
}

function parsePoFile(contents: string, path: string): Dictionary {
	const parsed = po.parse(contents);
	const isTemplate = path.endsWith('.pot');
	const dict: Dictionary = {};

	for (const [context, entries] of Object.entries(parsed.translations)) {
		for (const [msgid, entry] of Object.entries(entries)) {
			if (msgid === '') continue;

			const isFuzzy = entry.comments?.flag?.includes('fuzzy') ?? false;
			const allFormsTranslated = entry.msgstr.length > 0 && entry.msgstr.every((s) => s !== '');

			if (!isTemplate && (isFuzzy || !allFormsTranslated)) continue;

			const value = isTemplate ? msgid : (entry.msgstr[0] as string);

			if (context === '') {
				dict[msgid] = value;
			} else {
				if (!dict[context]) dict[context] = {};
				(dict[context] as Dictionary)[msgid] = value;
			}
		}
	}

	return dict;
}
