import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { LunariaConfig } from '../../src/config/types.ts';
import { createPathResolver } from '../../src/files/paths.ts';

describe('Path resolver', () => {
	it('should replace placeholders with their parameters', () => {
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
		assert.equal(
			toPath('src/content/docs/es/guides/example.md', 'es'),
			'src/content/docs/es/guides/example.md',
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
		assert.equal(
			toPath('translations/pt/recipes/cooking.mdx', 'pt'),
			'translations/pt/recipes/cooking.mdx',
		);
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

	it('should match paths case-sensitively', () => {
		const pattern = {
			source: 'docs/@path',
			locales: 'docs/@lang/@path',
		};

		const { isSourcePath, isLocalesPath, toPath } = createPathResolver(
			pattern,
			{ label: 'English', lang: 'en' },
			[{ label: 'Spanish', lang: 'es' }],
		);

		// A directory that only differs in casing from a locale is not that locale's directory.
		assert.equal(isLocalesPath('docs/ES/intro.md'), false);
		assert.equal(isSourcePath('docs/ES/intro.md'), true);
		assert.equal(toPath('docs/ES/intro.md', 'es'), 'docs/es/ES/intro.md');

		// The same goes for the static parts of the pattern.
		assert.equal(isSourcePath('DOCS/intro.md'), false);
		assert.equal(isLocalesPath('DOCS/es/intro.md'), false);
		assert.throws(() => toPath('DOCS/es/intro.md', 'en'));
	});

	it('should accept file names with `#` and `?`', () => {
		const pattern = 'src/@lang/:name.md';

		const { isSourcePath, isLocalesPath, toPath } = createPathResolver(
			pattern,
			{ label: 'English', lang: 'en' },
			[{ label: 'Spanish', lang: 'es' }],
		);

		assert.equal(isSourcePath('src/en/c#.md'), true);
		assert.equal(isLocalesPath('src/es/what?.md'), true);
		assert.equal(toPath('src/en/c#.md', 'es'), 'src/es/c#.md');

		// The path has to match entirely, without anything trailing it.
		assert.equal(isSourcePath('src/en/c#.md/'), false);
		assert.equal(isSourcePath('src/en/c#.md#'), false);
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

	it('should only accept parameters named exactly like a placeholder', () => {
		const locales = [{ label: 'Spanish', lang: 'es' }];

		assert.throws(
			() => createPathResolver('docs/:pathname', { label: 'English', lang: 'en' }, locales),
			/missing a valid path parameter/,
		);
		assert.throws(
			() => createPathResolver('docs/\\:lang/file.md', { label: 'English', lang: 'en' }, locales),
			/missing a valid path parameter/,
		);
	});

	it('should report invalid patterns where they were written', () => {
		const sourceLocale = { label: 'English', lang: 'en' };
		const locales = [{ label: 'Spanish', lang: 'es' }];

		// Positions point to the pattern as written, before `@lang` is replaced.
		assert.throws(
			() => createPathResolver('docs/@lang/what?.md', sourceLocale, locales),
			(error: Error) => {
				assert.match(error.message, /`docs\/@lang\/what\?\.md` is invalid: Unexpected "\?"/);
				assert.ok(error.message.includes(`\n  docs/@lang/what?.md\n  ${' '.repeat(15)}^`));
				return true;
			},
		);

		// Errors caused by a placeholder point to its start.
		assert.throws(
			() => createPathResolver('docs/@lang/a-@path+', sourceLocale, locales),
			(error: Error) => {
				assert.match(
					error.message,
					/Cannot repeat the parameter "path" without a prefix or suffix/,
				);
				assert.ok(error.message.includes(`\n  docs/@lang/a-@path+\n  ${' '.repeat(13)}^`));
				return true;
			},
		);

		assert.throws(
			() => createPathResolver('docs/@lang:name', sourceLocale, locales),
			(error: Error) => {
				assert.match(error.message, /Missing text between the parameter "lang" and the next one/);
				assert.ok(error.message.includes(`\n  docs/@lang:name\n  ${' '.repeat(10)}^`));
				return true;
			},
		);

		assert.throws(
			() => createPathResolver('docs/@lang/:name([a-z)', sourceLocale, locales),
			/`docs\/@lang\/:name\(\[a-z\)` is invalid: Invalid regular expression/,
		);
	});

	it('should prefer the longest locale value', () => {
		const { toPath } = createPathResolver('docs/@lang-@path', { label: 'English', lang: 'en' }, [
			{ label: 'Portuguese', lang: 'pt' },
			{ label: 'Brazilian Portuguese', lang: 'pt-BR' },
		]);

		// `pt` comes first in the config, but `pt-BR` is the locale of this file.
		assert.equal(toPath('docs/pt-BR-intro.md', 'en'), 'docs/en-intro.md');
		assert.equal(toPath('docs/pt-intro.md', 'en'), 'docs/en-intro.md');
	});

	it('should accept empty custom parameter values', () => {
		const { sourcePattern, isSourcePath, toPath } = createPathResolver(
			'i18n/messages@suffix.yml',
			{ label: 'English', lang: 'en', parameters: { suffix: '' } },
			[{ label: 'Spanish', lang: 'es', parameters: { suffix: '-es' } }],
		);

		assert.equal(sourcePattern, 'i18n/messages:suffix(|).yml');
		assert.equal(isSourcePath('i18n/messages.yml'), true);
		assert.equal(toPath('i18n/messages.yml', 'es'), 'i18n/messages-es.yml');
		assert.equal(toPath('i18n/messages-es.yml', 'en'), 'i18n/messages.yml');
	});

	it('should not read escaped placeholders', () => {
		const { sourcePattern, toPath } = createPathResolver(
			'docs/\\@lang/@lang/@path',
			{ label: 'English', lang: 'en' },
			[{ label: 'Spanish', lang: 'es' }],
		);

		assert.equal(sourcePattern, 'docs/\\@lang/:lang(en)/:path(.*)');
		assert.equal(toPath('docs/@lang/en/intro.md', 'es'), 'docs/@lang/es/intro.md');
	});

	it('should require the same parameters in the source and locales patterns', () => {
		const sourceLocale = { label: 'English', lang: 'en', parameters: { tag: 'en' } };
		const locales = [{ label: 'Spanish', lang: 'es', parameters: { tag: 'es' } }];

		assert.throws(
			() =>
				createPathResolver(
					{ source: 'docs/:collection/@path', locales: 'docs/@lang/@path' },
					sourceLocale,
					locales,
				),
			/the `:collection` is only used in the `source` pattern/,
		);
		assert.throws(
			() =>
				createPathResolver(
					{ source: 'docs/@path', locales: 'docs/@lang/(v\\d+)/@path' },
					sourceLocale,
					locales,
				),
			/the unnamed parameter 1 is only used in the `locales` pattern/,
		);
		// `lang` and custom parameters are filled in from the configuration, so they can differ.
		assert.doesNotThrow(() =>
			createPathResolver(
				{ source: 'docs/@path', locales: 'i18n/@tag/@path' },
				sourceLocale,
				locales,
			),
		);
	});

	it('should report paths that do not match the pattern', () => {
		const { toPath } = createPathResolver('docs/@lang/@path', { label: 'English', lang: 'en' }, [
			{ label: 'Spanish', lang: 'es' },
		]);

		assert.throws(
			() => toPath('other/en/intro.md', 'es'),
			/The path `other\/en\/intro\.md` does not match the file pattern `docs\/@lang\/@path`/,
		);
	});

	it('should match locale values literally', () => {
		const { isSourcePath, isLocalesPath, toPath } = createPathResolver(
			'docs/@lang/@tag/@path',
			{ label: 'English', lang: 'en.us', parameters: { tag: '(en)' } },
			[{ label: 'Traditional Chinese', lang: 'zh.tw', parameters: { tag: 'zh+TW' } }],
		);

		assert.equal(isSourcePath('docs/en.us/(en)/intro.md'), true);
		assert.equal(isSourcePath('docs/enXus/(en)/intro.md'), false);
		assert.equal(isLocalesPath('docs/zh.tw/zh+TW/intro.md'), true);
		assert.equal(isLocalesPath('docs/zh.tw/zhhTW/intro.md'), false);
		assert.equal(toPath('docs/en.us/(en)/intro.md', 'zh.tw'), 'docs/zh.tw/zh+TW/intro.md');
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

	it('should support custom parameters named after the start of another placeholder', () => {
		const sourceLocale = {
			label: 'English',
			lang: 'en',
			parameters: { langTag: 'en-US', pathPrefix: 'english' },
		};
		const locales: LunariaConfig['locales'] = [
			{
				label: 'Simplified Chinese',
				lang: 'zh-cn',
				parameters: { langTag: 'zh-CN', pathPrefix: 'chinese' },
			},
		];

		const tagResolver = createPathResolver('src/i18n/@langTag.yml', sourceLocale, locales);

		// `@langTag` shouldn't be read as the `@lang` placeholder followed by `Tag`.
		assert.equal(tagResolver.sourcePattern, 'src/i18n/:langTag(en-US).yml');
		assert.equal(tagResolver.localesPattern, 'src/i18n/:langTag(zh-CN).yml');
		assert.equal(tagResolver.toPath('src/i18n/en-US.yml', 'zh-cn'), 'src/i18n/zh-CN.yml');
		assert.equal(tagResolver.toPath('src/i18n/zh-CN.yml', 'en'), 'src/i18n/en-US.yml');

		// The shorter placeholders keep working alongside the longer ones.
		const mixedResolver = createPathResolver(
			'@pathPrefix/@lang/@langTag/@path',
			sourceLocale,
			locales,
		);

		assert.equal(
			mixedResolver.sourcePattern,
			':pathPrefix(english)/:lang(en)/:langTag(en-US)/:path(.*)',
		);
		assert.equal(
			mixedResolver.toPath('english/en/en-US/guides/intro.md', 'zh-cn'),
			'chinese/zh-cn/zh-CN/guides/intro.md',
		);
	});

	it('should replace placeholders used more than once', () => {
		const { sourcePattern, isSourcePath, toPath } = createPathResolver(
			'docs/@lang/intro.@lang.md',
			{ label: 'English', lang: 'en' },
			[{ label: 'Spanish', lang: 'es' }],
		);

		assert.equal(sourcePattern, 'docs/:lang(en)/intro.:lang(en).md');
		assert.equal(isSourcePath('docs/en/intro.en.md'), true);
		assert.equal(toPath('docs/en/intro.en.md', 'es'), 'docs/es/intro.es.md');
	});
});
