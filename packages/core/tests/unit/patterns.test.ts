import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { compile, type Match, match, PatternError, parse } from '../../src/files/patterns.ts';

/** Returns the params of a match as a plain object, or `false` if it did not match. */
const params = <P extends object>(result: Match<P>) => (result ? { ...result.params } : result);

describe('Patterns', () => {
	describe('parse', () => {
		it('should split patterns into text and parameters', () => {
			assert.deepEqual(parse('docs/:lang(en|pt)/:path(.*)'), [
				'docs',
				{ name: 'lang', prefix: '/', suffix: '', pattern: 'en|pt', modifier: '' },
				{ name: 'path', prefix: '/', suffix: '', pattern: '.*', modifier: '' },
			]);
		});

		it('should generate a safe pattern for parameters without one', () => {
			assert.deepEqual(parse('/users/:id'), [
				'/users',
				{ name: 'id', prefix: '/', suffix: '', pattern: '[^\\/]+?', modifier: '' },
			]);
			assert.deepEqual(parse('/:a-:b'), [
				{ name: 'a', prefix: '/', suffix: '', pattern: '[^\\/]+?', modifier: '' },
				'-',
				{ name: 'b', prefix: '', suffix: '', pattern: '(?:(?!-)[^\\/])+?', modifier: '' },
			]);
		});

		it('should support modifiers, groups, unnamed parameters and escapes', () => {
			assert.deepEqual(parse('pages/:path+.:lang(en).mdx'), [
				'pages',
				{ name: 'path', prefix: '/', suffix: '', pattern: '[^\\/]+?', modifier: '+' },
				{ name: 'lang', prefix: '.', suffix: '', pattern: 'en', modifier: '' },
				'.mdx',
			]);
			assert.deepEqual(parse('/docs{-:version(\\d+)}?/(.*)'), [
				'/docs',
				{ name: 'version', prefix: '-', suffix: '', pattern: '\\d+', modifier: '?' },
				{ name: 0, prefix: '/', suffix: '', pattern: '.*', modifier: '' },
			]);
			assert.deepEqual(parse('/foo\\:bar/:id?'), [
				'/foo:bar',
				{ name: 'id', prefix: '/', suffix: '', pattern: '[^\\/]+?', modifier: '?' },
			]);
		});

		it('should reject invalid patterns', () => {
			assert.throws(() => parse('/:'), /Missing parameter name after ":" at position 1/);
			assert.throws(() => parse('/:foo('), /Unbalanced parentheses at position 5/);
			assert.throws(
				() => parse('/:foo()'),
				/Missing regular expression between parentheses at position 5/,
			);
			assert.throws(() => parse('/:foo((a))'), /Capturing groups are not allowed.* at position 6/);
			assert.throws(
				() => parse('/:foo(?a)'),
				/Regular expression cannot start with "\?" at position 6/,
			);
			assert.throws(() => parse('/{-:foo'), /Missing "}" to close the group at position 1/);
			assert.throws(() => parse('/{-:a:b}'), /Unexpected ":b" in a group.* at position 5/);
			assert.throws(() => parse('/foo}'), /Unexpected "}", escape it.* at position 4/);
			assert.throws(() => parse('/what?.md'), /Unexpected "\?", escape it.* at position 5/);
			assert.throws(
				() => parse('/:a:b'),
				/Missing text between the parameter "a" and the next one at position 3/,
			);
		});

		it('should throw errors with the reason and position of the problem', () => {
			assert.throws(
				() => parse('docs/c++.md'),
				(error: unknown) => {
					assert.ok(error instanceof PatternError);
					assert.equal(error.index, 6);
					assert.equal(
						error.reason,
						'Unexpected "+", escape it with a backslash to match it literally',
					);
					return true;
				},
			);
		});

		it('should reject groups without a parameter', () => {
			assert.throws(
				() => parse('doc{s}?/:path(.*)'),
				/Groups must contain a parameter at position 3/,
			);
			assert.throws(
				() => parse('doc{s}/:path(.*)'),
				/Groups must contain a parameter at position 3/,
			);
		});

		it('should reject named capturing groups and lookbehinds', () => {
			assert.throws(
				() => parse('/:x((?<n>a))/:y'),
				/Capturing groups are not allowed.* at position 4/,
			);
			assert.throws(() => parse('/:x((?<=a)b)'), /Lookbehinds are not allowed at position 4/);
			assert.throws(() => parse('/:x((?<!a)b)'), /Lookbehinds are not allowed at position 4/);
			assert.doesNotThrow(() => parse('/:x((?!draft)[^/]+)'));
			assert.doesNotThrow(() => parse('/:x((?:a|b))'));
		});

		it('should reject a trailing backslash', () => {
			assert.throws(
				() => parse('docs/a\\'),
				/Missing character to escape after "\\" at position 6/,
			);
			assert.deepEqual(parse('docs/a\\\\'), ['docs/a\\']);
		});
	});

	describe('match', () => {
		it('should match paths and extract parameters', () => {
			const matcher = match('src/content/i18n/:lang(es|pt)/:path(.*)');

			const result = matcher('src/content/i18n/es/guides/example.mdx');

			assert.ok(result);
			assert.equal(result.path, 'src/content/i18n/es/guides/example.mdx');
			assert.equal(result.index, 0);
			assert.deepEqual(params(result), { lang: 'es', path: 'guides/example.mdx' });
			assert.equal(matcher('src/content/i18n/de/guides/example.mdx'), false);
			assert.equal(matcher('not/src/content/i18n/es/guides/example.mdx'), false);
			assert.equal(matcher('src/content/i18n/es'), false);
		});

		it('should match the entire path', () => {
			const matcher = match('/users/:id');

			assert.deepEqual(params(matcher('/users/123')), { id: '123' });
			assert.equal(matcher('/users'), false);
			assert.equal(matcher('/users/123/456'), false);
			// Unlike with URLs, a trailing delimiter makes it a different path.
			assert.equal(matcher('/users/123/'), false);
		});

		it('should be case-sensitive', () => {
			const matcher = match('docs/:lang(en|pt-BR)/:path(.*)');

			assert.deepEqual(params(matcher('docs/pt-BR/Guide.md')), { lang: 'pt-BR', path: 'Guide.md' });
			assert.equal(matcher('docs/EN/guide.md'), false);
			assert.equal(matcher('docs/pt-br/guide.md'), false);
			assert.equal(matcher('Docs/en/guide.md'), false);
		});

		it('should only treat `/` as a delimiter', () => {
			const matcher = match('src/:lang(en|es)/:name.md');

			// Characters that are delimiters in URLs are regular characters in file paths.
			assert.deepEqual(params(matcher('src/en/c#.md')), { lang: 'en', name: 'c#' });
			assert.deepEqual(params(matcher('src/es/what?.md')), { lang: 'es', name: 'what?' });
			assert.equal(matcher('src/en/nested/file.md'), false);
			assert.equal(matcher('src/en/file.md#'), false);
			assert.equal(matcher('src/en/file.md?'), false);
		});

		it('should handle optional and repeated parameters', () => {
			const optional = match('/:lang?/docs/:path(.*)');
			assert.deepEqual(params(optional('/en/docs/a/b')), { lang: 'en', path: 'a/b' });
			assert.deepEqual(params(optional('/docs/a/b')), { path: 'a/b' });

			const repeated = match('pages/:path+.:lang(en|pt).mdx');
			assert.deepEqual(params(repeated('pages/guides/deep/intro.pt.mdx')), {
				path: ['guides', 'deep', 'intro'],
				lang: 'pt',
			});
			assert.equal(repeated('pages/intro.de.mdx'), false);

			const zeroOrMore = match('/files/:path*');
			assert.deepEqual(params(zeroOrMore('/files/a/b/c')), { path: ['a', 'b', 'c'] });
			assert.deepEqual(params(zeroOrMore('/files')), {});
		});

		it('should split repeated parameters with both a prefix and a suffix', () => {
			const matcher = match('src{/:path.}+:lang(en|es).md');

			assert.deepEqual(params(matcher('src/a./b.en.md')), { path: ['a', 'b'], lang: 'en' });
			assert.deepEqual(params(matcher('src/a.es.md')), { path: ['a'], lang: 'es' });
		});

		it('should number unnamed parameters', () => {
			const matcher = match('/(apple|orange)/:id(\\d+)');

			assert.deepEqual(params(matcher('/apple/12')), { 0: 'apple', id: '12' });
			assert.equal(matcher('/apple/x'), false);
		});

		it('should reject repeating a parameter without a prefix or suffix', () => {
			assert.throws(
				() => match(':foo(.+)+'),
				/Cannot repeat the parameter "foo" without a prefix or suffix.* at position 0/,
			);
			assert.throws(() => compile('a-{:foo}*'), /Cannot repeat the parameter "foo"/);
		});

		it('should accept already parsed tokens', () => {
			const tokens = parse('docs/:lang(en|pt)/:path(.*)');

			assert.deepEqual(params(match(tokens)('docs/pt/a/b.md')), { lang: 'pt', path: 'a/b.md' });
			assert.equal(compile(tokens)({ lang: 'en', path: 'a/b.md' }), 'docs/en/a/b.md');
		});
	});

	describe('compile', () => {
		it('should build paths from parameters', () => {
			const toPath = compile<{ lang: string; path: string }>('docs/:lang(es|pt)/:path(.*)');

			assert.equal(
				toPath({ lang: 'es', path: 'guides/example.mdx' }),
				'docs/es/guides/example.mdx',
			);
		});

		it('should validate parameters against their pattern', () => {
			const toPath = compile<{ lang: string; path: string }>('docs/:lang(es|pt)/:path(.*)');

			assert.throws(
				() => toPath({ lang: 'de', path: 'x' }),
				/Expected "lang" to match "es\|pt", but got "de"/,
			);
			assert.throws(
				() => toPath({ lang: 'ES', path: 'x' }),
				/Expected "lang" to match "es\|pt", but got "ES"/,
			);
			assert.throws(() => toPath({ lang: 'es' } as never), /Expected "path" to be a string/);
		});

		it('should handle optional and repeated parameters', () => {
			const optional = compile<{ lang?: string; path: string }>('/:lang?/docs/:path(.*)');
			assert.equal(optional({ lang: 'en', path: 'a/b' }), '/en/docs/a/b');
			assert.equal(optional({ path: 'a/b' }), '/docs/a/b');

			const repeated = compile<{ path: string[]; lang: string }>('pages/:path+.:lang(en|pt).mdx');
			assert.equal(
				repeated({ path: ['guides', 'intro'], lang: 'pt' }),
				'pages/guides/intro.pt.mdx',
			);
			assert.throws(() => repeated({ path: [], lang: 'pt' }), /Expected "path" to not be empty/);
			assert.throws(
				() => compile<{ lang: string[] }>('/:lang')({ lang: ['a'] }),
				/Expected "lang" to not repeat, but got an array/,
			);
		});

		it('should round-trip parameters extracted by match', () => {
			const pattern = 'pages/:path+.:lang(en|pt).mdx';
			const matched = match<{ path: string[]; lang: string }>(pattern)('pages/a/b/c.en.mdx');

			assert.ok(matched);
			assert.equal(compile(pattern)({ ...matched.params, lang: 'pt' }), 'pages/a/b/c.pt.mdx');

			const affixed = 'src{/:path.}+:lang(en|es).md';
			const affixedMatch = match<{ path: string[]; lang: string }>(affixed)('src/a./b.en.md');

			assert.ok(affixedMatch);
			assert.equal(compile(affixed)({ ...affixedMatch.params, lang: 'es' }), 'src/a./b.es.md');
		});
	});
});
