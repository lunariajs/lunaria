import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { findMissingKeys } from '../../src/status/status.ts';

describe('Dictionaries', () => {
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
