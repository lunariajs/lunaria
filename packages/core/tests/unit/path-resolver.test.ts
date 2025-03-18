import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createPathResolver } from '../../src/files/paths.ts';

describe('Path resolver', () => {
	it("should convert pattern from Lunaria's format into path-to-regexp's format", () => {
		/**
		 * Case 1
		 */
		const firstPattern = {
			source: 'src/content/docs/@path',
			locales: 'src/content/i18n/@lang/@path',
		};

		const firstResolver = createPathResolver(firstPattern, { label: 'English', lang: 'en' }, [
			{ label: 'Spanish', lang: 'es' },
			{ label: 'Portuguese', lang: 'pt' },
		]);

		// Checks if the patterns are correctly converted in a double-string pattern.
		assert.equal(firstResolver.sourcePattern, 'src/content/docs/:path(.*)');
		// Also checks if the pattern for when `@lang/` (@lang but directory) is correctly converted.
		assert.equal(firstResolver.localesPattern, 'src/content/i18n/:lang(es|pt)/:path(.*)');

		/**
		 * Case 2
		 */
		const secondPattern = 'pages/:path+.@lang.mdx';

		const secondResolver = createPathResolver(secondPattern, { label: 'English', lang: 'en' }, [
			{ label: 'Spanish', lang: 'es' },
			{ label: 'Portuguese', lang: 'pt' },
		]);

		// Checks if the pattern is correctly converted in a single-string pattern.
		// Also checks if the pattern for when `@lang` is correctly converted.
		assert.equal(secondResolver.sourcePattern, 'pages/:path+.:lang(en).mdx');
		assert.equal(secondResolver.localesPattern, 'pages/:path+.:lang(es|pt).mdx');
	});

	it('should make valid paths from single-string pattern', () => {
		const pattern = 'src/content/docs/@lang/@path';

		const { toPath } = createPathResolver(pattern, { label: 'English', lang: 'en' }, [
			{ label: 'Spanish', lang: 'es' },
			{ label: 'Portuguese', lang: 'pt' },
		]);

		assert.equal(toPath('src/content/docs/en/test.mdx', 'es'), 'src/content/docs/es/test.mdx');
		assert.equal(
			toPath('src/content/docs/en/reference/api-reference.mdx', 'pt'),
			'src/content/docs/pt/reference/api-reference.mdx',
		);
		assert.equal(
			toPath('src/content/docs/es/guides/example.md', 'en'),
			'src/content/docs/en/guides/example.md',
		);
	});

	it('should make valid paths from double-string pattern', () => {
		const pattern = {
			source: 'docs/@path',
			locales: 'translations/@lang/@path',
		};

		const { toPath } = createPathResolver(pattern, { label: 'English', lang: 'en' }, [
			{ label: 'Spanish', lang: 'es' },
			{ label: 'Portuguese', lang: 'pt' },
		]);

		assert.equal(toPath('docs/test.mdx', 'es'), 'translations/es/test.mdx');
		assert.equal(toPath('docs/examples/theory.mdx', 'pt'), 'translations/pt/examples/theory.mdx');
		assert.equal(toPath('translations/pt/recipes/cooking.mdx', 'en'), 'docs/recipes/cooking.mdx');
	});

	it('should correctly match source and locale paths from single-string pattern', () => {
		const pattern = 'docs/@lang/@path';

		const { isSourcePath, isLocalesPath } = createPathResolver(
			pattern,
			{ label: 'Portuguese', lang: 'pt' },
			[
				{ label: 'Spanish', lang: 'es' },
				{ label: 'English', lang: 'en' },
			],
		);

		assert.equal(isSourcePath('docs/pt/test.mdx'), true);
		assert.equal(isSourcePath('docs/es/reference/api-reference.mdx'), false);
		assert.equal(isSourcePath('not/docs/pt/guides/example.md'), false);

		assert.equal(isLocalesPath('docs/es/test.mdx'), true);
		assert.equal(isLocalesPath('docs/zh-cn/reference/api-reference.mdx'), false);
		assert.equal(isLocalesPath('not/docs/en/guides/example.md'), false);
	});

	it('should correctly match source and locale paths from double-string pattern', () => {
		const pattern = {
			source: 'docs/@path',
			locales: 'docs/@lang/@path',
		};

		const { isSourcePath, isLocalesPath } = createPathResolver(
			pattern,
			{ label: 'Portuguese', lang: 'pt' },
			[
				{ label: 'Spanish', lang: 'es' },
				{ label: 'English', lang: 'en' },
			],
		);

		assert.equal(isSourcePath('docs/test.mdx'), true);
		assert.equal(isSourcePath('docs/es/reference/api-reference.mdx'), false);
		assert.equal(isSourcePath('not/docs/pt/guides/example.md'), false);

		assert.equal(isLocalesPath('docs/es/test.mdx'), true);
		assert.equal(isLocalesPath('docs/zh-cn/reference/api-reference.mdx'), false);
		assert.equal(isLocalesPath('not/docs/en/guides/example.md'), false);
	});

	it('should accept any pattern with at least one valid parameter', () => {
		assert.throws(() =>
			createPathResolver('docs/path/lang.md', { label: 'English', lang: 'en' }, [
				{ label: 'Spanish', lang: 'es' },
			]),
		);
		assert.doesNotThrow(() =>
			createPathResolver('docs/:path.md', { label: 'English', lang: 'en' }, [
				{ label: 'Spanish', lang: 'es' },
			]),
		);
		assert.doesNotThrow(() =>
			createPathResolver(
				{ source: 'src/ui/@lang.ts', locales: 'src/i18n/@lang.ts' },
				{ label: 'English', lang: 'en' },
				[{ label: 'Spanish', lang: 'es' }],
			),
		);
	});

	it('should correctly evaluate custom parameters', () => {
		const pattern = 'src/i18n/@tag.yml';

		const { toPath } = createPathResolver(
			pattern,
			{ label: 'English', lang: 'en', parameters: { tag: 'en' } },
			[{ label: 'Simplified Chinese', lang: 'zh-cn', parameters: { tag: 'zh-CN' } }],
		);

		assert.equal(toPath('src/i18n/en.yml', 'zh-cn'), 'src/i18n/zh-CN.yml');
		assert.equal(toPath('src/i18n/zh-CN.yml', 'en'), 'src/i18n/en.yml');
	});
});
