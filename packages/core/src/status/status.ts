import { Traverse } from 'neotraverse/modern';
import type { OptionalKeys } from '../config/types.js';
import { InvalidDictionaryStructure, UnsupportedDictionaryFileFormat } from '../errors/errors.js';
import { DictionarySchema } from './schema.js';
import type { Dictionary } from './types.js';
import { createJiti } from 'jiti';
import yaml from 'js-yaml';

export async function getMissingDictionaryKeys(
	sourceDictionary: { fsPath: string; contents: string },
	localeDictionary: { fsPath: string; contents: string },
	optionalKeys: OptionalKeys | undefined,
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

	return findMissingKeys(optionalKeys, parsedSourceDict.data, parsedLocaleDict.data);
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

	const hasOptionalParent = (path: PropertyKey[]) => {
		// is upmost parent
		if (path.length === 1) return optionalKeysTraverse.get(path) === true;

		// not upmost parent
		if (optionalKeysTraverse.get(path) === true) return true;

		// check if parent of parent is optional
		return hasOptionalParent([...path].slice(0, -1));
	};

	const missingKeys = sourceDictTraverse
		.paths()
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
		const jiti = createJiti(import.meta.url);

		return await jiti.import(path, { default: true });
	}

	/** Regex to match YAML files. */
	if (/\.(yml|yaml)$/.test(path)) {
		return yaml.load(contents);
	}

	/** Regex to match JSON files. */
	if (/\.json$/.test(path)) {
		return JSON.parse(contents);
	}

	throw new Error(UnsupportedDictionaryFileFormat.message(path));
}
