import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { findMissingKeys, loadDictionary, mergeBaseDictionaries } from '../../src/status/status.ts';

describe('findMissingKeys', () => {
	it('should return all missing keys when no optional keys are set', () => {
		const missingKeys = findMissingKeys(
			undefined,
			{
				key1: 'value1',
				key2: 'value2',
				key3: 'value3',
				key4: {
					key5: 'value5',
					key6: 'value6',
					key8: {
						key9: 'value9',
					},
				},
			},
			{
				key1: 'value1',
				key3: 'value3',
			},
		);

		assert.deepEqual(missingKeys, [
			['key2'],
			['key4', 'key5'],
			['key4', 'key6'],
			['key4', 'key8', 'key9'],
		]);
	});

	it('should ignore keys marked as optional', () => {
		const optionalKeys = {
			key2: true,
			key3: false,
			key4: {
				key6: true,
				key8: true,
			},
			key10: true,
		};

		const missingKeys = findMissingKeys(
			optionalKeys,
			{
				key1: 'value1',
				key2: 'value2',
				key3: 'value3',
				key4: {
					key5: 'value5',
					key6: 'value6',
					key8: {
						key9: 'value9',
					},
				},
				key10: {
					key11: 'value11',
					key12: 'value12',
					key13: {
						key14: 'value14',
					},
				},
			},
			{
				key1: 'value1',
			},
		);

		assert.deepEqual(missingKeys, [['key3'], ['key4', 'key5']]);
	});
});

describe('mergeBaseDictionaries', () => {
	it('should return locale dict unchanged when no bases are given', () => {
		const locale = { key1: 'value1', key2: 'value2' };
		const result = mergeBaseDictionaries(locale, []);
		assert.deepEqual(result, locale);
	});

	it('should fill in top-level keys absent from the locale with base keys', () => {
		const locale = { key1: 'locale1' };
		const base = { key1: 'base1', key2: 'base2', key3: 'base3' };
		const result = mergeBaseDictionaries(locale, [base]);
		assert.deepEqual(result, { key1: 'locale1', key2: 'base2', key3: 'base3' });
	});

	it('should never overwrite keys already present in the locale', () => {
		const locale = { key1: 'locale1', key2: 'locale2' };
		const base = { key1: 'base1', key2: 'base2', key3: 'base3' };
		const result = mergeBaseDictionaries(locale, [base]);
		assert.equal(result.key1, 'locale1');
		assert.equal(result.key2, 'locale2');
		assert.equal(result.key3, 'base3');
	});

	it('should deep-merge nested objects, preserving locale keys at every level', () => {
		const locale = { ns: { key1: 'locale1' } };
		const base = { ns: { key1: 'base1', key2: 'base2' }, top: 'baseTop' };
		const result = mergeBaseDictionaries(locale, [base]);
		assert.deepEqual(result, {
			ns: { key1: 'locale1', key2: 'base2' },
			top: 'baseTop',
		});
	});

	it('should apply multiple bases left-to-right, earlier bases taking precedence over later ones', () => {
		const locale = { key1: 'locale1' };
		const base1 = { key2: 'base1-key2', key3: 'base1-key3' };
		const base2 = { key2: 'base2-key2', key4: 'base2-key4' };
		const result = mergeBaseDictionaries(locale, [base1, base2]);
		// key2 comes from base1 (first base wins over second base)
		// key4 comes from base2 (only present in base2)
		assert.deepEqual(result, {
			key1: 'locale1',
			key2: 'base1-key2',
			key3: 'base1-key3',
			key4: 'base2-key4',
		});
	});

	it('should not report keys covered by a base as missing', () => {
		const source = { key1: 'src1', key2: 'src2', key3: 'src3' };
		const locale = { key1: 'locale1' };
		const base = { key2: 'base2' };

		// Without merge: key2 and key3 are missing.
		assert.deepEqual(findMissingKeys(undefined, source, locale), [['key2'], ['key3']]);

		// With merge: key2 is covered by the base, only key3 is still missing.
		const effective = mergeBaseDictionaries(locale, [base]);
		assert.deepEqual(findMissingKeys(undefined, source, effective), [['key3']]);
	});

	it('should handle deeply nested keys covered by a base', () => {
		const source = { ns: { a: 'srcA', b: 'srcB' } };
		const locale = { ns: { a: 'localeA' } };
		const base = { ns: { b: 'baseB' } };

		// Without merge: ns.b is missing.
		assert.deepEqual(findMissingKeys(undefined, source, locale), [['ns', 'b']]);

		// With merge: ns.b is covered by base, nothing missing.
		const effective = mergeBaseDictionaries(locale, [base]);
		assert.deepEqual(findMissingKeys(undefined, source, effective), []);
	});

	it('should chain: each successive base only fills what prior bases and locale did not cover', () => {
		const source = { a: 'srcA', b: 'srcB', c: 'srcC', d: 'srcD' };
		const locale = { a: 'localeA' };
		const base1 = { b: 'base1B' }; // covers b
		const base2 = { c: 'base2C' }; // covers c; d still missing

		const effective = mergeBaseDictionaries(locale, [base1, base2]);
		assert.deepEqual(findMissingKeys(undefined, source, effective), [['d']]);
	});
});

describe('loadDictionary with .po files', () => {
	it('should parse basic msgid/msgstr pairs', async () => {
		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr "Hola"',
			'',
			'msgid "Goodbye"',
			'msgstr "Adiós"',
		].join('\n');

		const dict = await loadDictionary('locale.po', po);
		assert.deepEqual(dict, { Hello: 'Hola', Goodbye: 'Adiós' });
	});

	it('should nest entries with msgctxt under the context key', async () => {
		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr "Hola"',
			'',
			'msgctxt "menu"',
			'msgid "File"',
			'msgstr "Archivo"',
			'',
			'msgctxt "menu"',
			'msgid "Edit"',
			'msgstr "Editar"',
		].join('\n');

		const dict = await loadDictionary('locale.po', po);
		assert.deepEqual(dict, {
			Hello: 'Hola',
			menu: { File: 'Archivo', Edit: 'Editar' },
		});
	});

	it('should omit entries with empty msgstr in .po files', async () => {
		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr "Hola"',
			'',
			'msgid "Untranslated"',
			'msgstr ""',
		].join('\n');

		const dict = await loadDictionary('locale.po', po);
		assert.deepEqual(dict, { Hello: 'Hola' });
	});

	it('should emit all entries for .pot files using msgid as value', async () => {
		const pot = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr ""',
			'',
			'msgid "Goodbye"',
			'msgstr ""',
		].join('\n');

		const dict = await loadDictionary('messages.pot', pot);
		assert.deepEqual(dict, { Hello: 'Hello', Goodbye: 'Goodbye' });
	});

	it('should omit fuzzy entries in .po files', async () => {
		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr "Hola"',
			'',
			'#, fuzzy',
			'msgid "Maybe"',
			'msgstr "Quizás"',
		].join('\n');

		const dict = await loadDictionary('locale.po', po);
		assert.deepEqual(dict, { Hello: 'Hola' });
	});

	it('should require all plural forms to be non-empty', async () => {
		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\nPlural-Forms: nplurals=2; plural=(n != 1);\\n"',
			'',
			'msgid "One file"',
			'msgid_plural "%d files"',
			'msgstr[0] "Un archivo"',
			'msgstr[1] "%d archivos"',
			'',
			'msgid "One item"',
			'msgid_plural "%d items"',
			'msgstr[0] "Un elemento"',
			'msgstr[1] ""',
		].join('\n');

		const dict = await loadDictionary('locale.po', po);
		assert.deepEqual(dict, { 'One file': 'Un archivo' });
	});

	it('should work end-to-end with findMissingKeys', async () => {
		const pot = [
			'msgid ""',
			'msgstr ""',
			'',
			'msgid "Hello"',
			'msgstr ""',
			'',
			'msgid "Goodbye"',
			'msgstr ""',
			'',
			'msgctxt "menu"',
			'msgid "File"',
			'msgstr ""',
		].join('\n');

		const po = [
			'msgid ""',
			'msgstr "Content-Type: text/plain; charset=UTF-8\\n"',
			'',
			'msgid "Hello"',
			'msgstr "Hola"',
			'',
			'msgid "Goodbye"',
			'msgstr ""',
		].join('\n');

		const sourceDict = await loadDictionary('messages.pot', pot);
		const localeDict = await loadDictionary('es.po', po);

		const missing = findMissingKeys(undefined, sourceDict, localeDict);
		assert.deepEqual(missing, [['Goodbye'], ['menu', 'File']]);
	});
});
