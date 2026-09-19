import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { serializeStatus } from '../../src/status/serialize.ts';
import type { LunariaStatus } from '../../src/status/types.ts';

const commit = {
	author: { name: 'lunaria-test', email: 'lunaria-test@example.com' },
	message: 'add docs',
	body: '',
	date: new Date('2024-01-01T00:00:00.000Z'),
	hash: 'abc123',
	refs: '',
};

const git = { latestCommit: commit, latestTrackedCommit: commit };

const status: LunariaStatus = [
	{
		include: ['src/content/**/*.mdx'],
		pattern: 'src/content/@lang/@path',
		type: 'universal',
		source: { path: 'src/content/en/guide.mdx', lang: 'en', git, contents: '# Guide\n' },
		localizations: [
			{
				lang: 'es',
				path: 'src/content/es/guide.mdx',
				type: 'universal',
				status: 'up-to-date',
				git,
				contents: '# Guía\n',
			},
			{ lang: 'pt', path: 'src/content/pt/guide.mdx', status: 'missing' },
		],
	},
];

describe('Status serialization', () => {
	it('should remove the file contents from the status', () => {
		const [entry] = serializeStatus(status);
		assert.ok(entry);

		assert.equal('contents' in entry.source, false);
		assert.ok(entry.localizations.every((localization) => !('contents' in localization)));
		assert.equal(entry.source.path, 'src/content/en/guide.mdx');
		assert.equal(entry.localizations.length, 2);
	});
});
