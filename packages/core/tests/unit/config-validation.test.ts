import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { validateFinalConfig, validateInitialConfig } from '../../src/config/config.ts';
import { sampleValidConfig } from '../utils.ts';

describe('Configuration validation', () => {
	it('should throw when invalid', () => {
		// @ts-expect-error - Testing invalid config
		assert.throws(() => validateFinalConfig({ foo: 'bar' }));
	});

	it('should throw when there are repeated locales', () => {
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				locales: [
					{
						label: 'English',
						lang: 'en',
					},
				],
			}),
		);
	});

	it('should accept unset `sourceLocale`, `locales`, and `files` before setup hook', () => {
		assert.doesNotThrow(() =>
			validateInitialConfig({
				...sampleValidConfig,
				files: undefined,
				locales: undefined,
				sourceLocale: undefined,
			}),
		);
	});

	it("should throw when `sourceLocale`, `locales`, and `files` aren't set after setup hook", () => {
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				files: undefined,
				locales: undefined,
				sourceLocale: undefined,
			}),
		);
	});

	it('should not accept relative paths in rootDir property', () => {
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				repository: { name: 'yanthomasdev/lunaria', rootDir: './examples/starlight/' },
			}),
		);
	});

	it('should remove trailing slashes from repository properties', () => {
		const resultingConfig = validateFinalConfig({
			...sampleValidConfig,
			repository: {
				name: 'yanthomasdev/lunaria/',
				rootDir: 'examples/starlight/',
			},
		});

		assert.equal(resultingConfig.repository.name, 'yanthomasdev/lunaria');
		assert.equal(resultingConfig.repository.rootDir, 'examples/starlight');
	});

	it('should throw when not all locales share the same parameters keys', () => {
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				sourceLocale: {
					lang: 'en',
					label: 'English',
					parameters: {
						tag: 'en',
					},
				},
				locales: [
					{
						label: 'Simplified Chinese',
						lang: 'zh-cn',
						parameters: {
							tag: 'zh-CN',
							some: 'value',
						},
					},
				],
			}),
		);
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				sourceLocale: {
					lang: 'en',
					label: 'English',
				},
				locales: [
					{
						label: 'Simplified Chinese',
						lang: 'zh-cn',
						parameters: {
							tag: 'zh-CN',
							some: 'value',
						},
					},
				],
			}),
		);
	});
});
