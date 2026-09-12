import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createGitHostingLinks } from '../../src/utils/utils.ts';

describe('Git hosting links', () => {
	it('should correctly create paths for GitHub', () => {
		const githubWithRootDir = createGitHostingLinks({
			name: 'yanthomasdev/lunaria',
			branch: 'main',
			hosting: 'github',
			rootDir: 'examples/starlight',
		});

		assert.equal(githubWithRootDir.clone(), 'https://github.com/yanthomasdev/lunaria.git');
		assert.equal(
			githubWithRootDir.create('src/i18n/ui.ts'),
			'https://github.com/yanthomasdev/lunaria/new/main?filename=examples/starlight/src/i18n/ui.ts',
		);
		assert.equal(
			githubWithRootDir.source('src/content/docs/path.md'),
			'https://github.com/yanthomasdev/lunaria/blob/main/examples/starlight/src/content/docs/path.md',
		);
		assert.equal(
			githubWithRootDir.history('src/content/path.md'),
			'https://github.com/yanthomasdev/lunaria/commits/main/examples/starlight/src/content/path.md',
		);
		assert.equal(
			githubWithRootDir.history('src/content/path.md', '2024-08-11T12:00:00.000Z'),
			'https://github.com/yanthomasdev/lunaria/commits/main/examples/starlight/src/content/path.md?since=2024-08-11T12:00:00.000Z',
		);

		const githubWithoutRootDir = createGitHostingLinks({
			name: 'yanthomasdev/lunaria',
			branch: 'main',
			hosting: 'github',
			rootDir: '.',
		});

		assert.equal(githubWithoutRootDir.clone(), 'https://github.com/yanthomasdev/lunaria.git');
		assert.equal(
			githubWithoutRootDir.create('src/i18n/ui.ts'),
			'https://github.com/yanthomasdev/lunaria/new/main?filename=src/i18n/ui.ts',
		);
		assert.equal(
			githubWithoutRootDir.source('src/content/docs/path.md'),
			'https://github.com/yanthomasdev/lunaria/blob/main/src/content/docs/path.md',
		);
		assert.equal(
			githubWithoutRootDir.history('src/content/path.md'),
			'https://github.com/yanthomasdev/lunaria/commits/main/src/content/path.md',
		);
		assert.equal(
			githubWithoutRootDir.history('src/content/path.md', '2024-08-11T12:00:00.000Z'),
			'https://github.com/yanthomasdev/lunaria/commits/main/src/content/path.md?since=2024-08-11T12:00:00.000Z',
		);
	});

	it('should correctly create paths for GitLab', () => {
		const gitlabWithRootDir = createGitHostingLinks({
			name: 'yanthomasdev/lunaria',
			branch: 'main',
			hosting: 'gitlab',
			rootDir: 'examples/starlight',
		});

		assert.equal(gitlabWithRootDir.clone(), 'https://gitlab.com/yanthomasdev/lunaria.git');
		assert.equal(
			gitlabWithRootDir.create('src/i18n/ui.ts'),
			'https://gitlab.com/yanthomasdev/lunaria/-/new/main?file_name=examples/starlight/src/i18n/ui.ts',
		);
		assert.equal(
			gitlabWithRootDir.source('src/content/docs/path.md'),
			'https://gitlab.com/yanthomasdev/lunaria/-/blob/main/examples/starlight/src/content/docs/path.md',
		);
		assert.equal(
			gitlabWithRootDir.history('src/content/path.md'),
			'https://gitlab.com/yanthomasdev/lunaria/-/commits/main/examples/starlight/src/content/path.md',
		);
		assert.equal(
			gitlabWithRootDir.history('src/content/path.md', '2024-08-11T12:00:00.000Z'),
			'https://gitlab.com/yanthomasdev/lunaria/-/commits/main/examples/starlight/src/content/path.md?since=2024-08-11T12:00:00.000Z',
		);

		const gitlabWithoutRootDir = createGitHostingLinks({
			name: 'yanthomasdev/lunaria',
			branch: 'main',
			hosting: 'gitlab',
			rootDir: '.',
		});

		assert.equal(gitlabWithoutRootDir.clone(), 'https://gitlab.com/yanthomasdev/lunaria.git');
		assert.equal(
			gitlabWithoutRootDir.create('src/i18n/ui.ts'),
			'https://gitlab.com/yanthomasdev/lunaria/-/new/main?file_name=src/i18n/ui.ts',
		);
		assert.equal(
			gitlabWithoutRootDir.source('src/content/docs/path.md'),
			'https://gitlab.com/yanthomasdev/lunaria/-/blob/main/src/content/docs/path.md',
		);
		assert.equal(
			gitlabWithoutRootDir.history('src/content/path.md'),
			'https://gitlab.com/yanthomasdev/lunaria/-/commits/main/src/content/path.md',
		);
		assert.equal(
			gitlabWithoutRootDir.history('src/content/path.md', '2024-08-11T12:00:00.000Z'),
			'https://gitlab.com/yanthomasdev/lunaria/-/commits/main/src/content/path.md?since=2024-08-11T12:00:00.000Z',
		);
	});
});
