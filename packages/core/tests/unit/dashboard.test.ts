import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { validateFinalConfig } from '../../src/config/config.ts';
import { getCollapsedPath, getDashboardStatus } from '../../src/dashboard/helpers.ts';
import { generateDashboard, html } from '../../src/dashboard/index.ts';
import type { LunariaStatus, StatusLocalizationEntry } from '../../src/status/types.ts';
import { sampleValidConfig } from '../utils.ts';

const commit = {
	author: { name: 'lunaria-test', email: 'lunaria-test@example.com' },
	message: 'add docs',
	body: '',
	date: new Date('2024-01-01T00:00:00.000Z'),
	hash: 'abc123',
	refs: '',
};

const git = { latestCommit: commit, latestTrackedCommit: commit };

const sampleStatus: LunariaStatus = [
	{
		include: ['src/content/**/*.mdx'],
		pattern: 'src/content/@lang/@path',
		type: 'universal',
		source: { path: 'src/content/en/current.mdx', lang: 'en', git, contents: '' },
		localizations: [
			{
				lang: 'es',
				path: 'src/content/es/current.mdx',
				type: 'universal',
				status: 'up-to-date',
				git,
				contents: '',
			},
		],
	},
	{
		include: ['src/content/**/*.mdx'],
		pattern: 'src/content/@lang/@path',
		type: 'universal',
		source: { path: 'src/content/en/missing.mdx', lang: 'en', git, contents: '' },
		localizations: [{ lang: 'es', path: 'src/content/es/missing.mdx', status: 'missing' }],
	},
	{
		include: ['src/i18n/**/*.json'],
		pattern: 'src/i18n/@lang/@path',
		type: 'dictionary',
		source: { path: 'src/i18n/en/ui.json', lang: 'en', git, contents: '' },
		localizations: [
			{
				lang: 'es',
				path: 'src/i18n/es/ui.json',
				type: 'dictionary',
				status: 'up-to-date',
				git,
				contents: '',
				missingKeys: [['nav', 'home'], ['title']],
			},
		],
	},
];

describe('Dashboard', () => {
	it('should render the dashboard with the default options', () => {
		const config = validateFinalConfig(sampleValidConfig);
		const dashboard = generateDashboard(config, sampleStatus);

		assert.ok(dashboard.startsWith('\n\t\t<!doctype html>'));
		assert.ok(dashboard.includes('<html dir="ltr" lang="en">'));
		assert.ok(dashboard.includes('<title>Localization Status</title>'));
		assert.ok(dashboard.includes('<h1>Localization Status</h1>'));
		assert.ok(dashboard.includes('Spanish (es)'));
		assert.ok(dashboard.includes('1 done, 1 outdated, 1 missing'));
		// Missing files get a link to create the localized file in the git hosting platform.
		assert.ok(
			dashboard.includes(
				'https://github.com/yanthomasdev/lunaria/new/main?filename=src/content/es/missing.mdx',
			),
		);
		// Dictionaries with missing keys are listed as outdated, with their missing keys as dot-separated paths.
		assert.ok(dashboard.includes('<li>nav.home</li>'));
		assert.ok(dashboard.includes('<li>title</li>'));
		assert.ok(dashboard.includes('incomplete localization'));
		// The source change history link starts from the localization's latest tracked commit.
		assert.ok(
			dashboard.includes(
				'https://github.com/yanthomasdev/lunaria/commits/main/src/i18n/en/ui.json?since=2024-01-01T00:00:00.000Z',
			),
		);
	});

	it('should apply the dashboard configuration options', () => {
		const config = validateFinalConfig({
			...sampleValidConfig,
			dashboard: {
				title: 'Lunaria Status',
				description: 'Custom description',
				site: 'https://localization.lunaria.dev/',
				basesToHide: ['src/content/'],
				ui: {
					lang: 'pt-BR',
					dir: 'rtl',
					'statusByFile.heading': 'Estado por arquivo',
				},
			},
		});
		const dashboard = generateDashboard(config, sampleStatus);

		assert.ok(dashboard.includes('<html dir="rtl" lang="pt-BR">'));
		assert.ok(dashboard.includes('<title>Lunaria Status</title>'));
		assert.ok(dashboard.includes('<meta name="description" content="Custom description" />'));
		assert.ok(
			dashboard.includes('<link rel="canonical" href="https://localization.lunaria.dev/" />'),
		);
		assert.ok(dashboard.includes('Estado por arquivo'));
		// Other UI labels keep their default values.
		assert.ok(dashboard.includes('Localization progress by locale'));
		// Hidden bases are removed from the displayed paths, but not from the links.
		assert.ok(dashboard.includes('>en/current.mdx</a>'));
		assert.ok(
			dashboard.includes(
				'https://github.com/yanthomasdev/lunaria/blob/main/src/content/en/current.mdx',
			),
		);
	});

	it('should apply the renderer slots and overrides', () => {
		const config = validateFinalConfig({
			...sampleValidConfig,
			renderer: {
				slots: {
					head: () => html`<meta name="robots" content="noindex" />`,
					afterTitle: (config) => html`<p>Tracking ${config.repository.name}</p>`,
				},
				overrides: {
					statusByFile: (_, status) =>
						html`<ul>${status.map((entry) => html`<li>${entry.source.path}</li>`)}</ul>`,
				},
			},
		});
		const dashboard = generateDashboard(config, sampleStatus);

		assert.ok(dashboard.includes('<meta name="robots" content="noindex" />'));
		assert.ok(dashboard.includes('<p>Tracking yanthomasdev/lunaria</p>'));
		assert.ok(dashboard.includes('<li>src/content/en/current.mdx</li>'));
		assert.ok(!dashboard.includes('Localization status by file'));
	});

	it('should validate the dashboard options', () => {
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				dashboard: { customCss: ['src/styles/lunaria.css'] },
			}),
		);
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				dashboard: { favicon: { inline: './favicon.png' } },
			}),
		);
		assert.throws(() =>
			validateFinalConfig({
				...sampleValidConfig,
				dashboard: { favicon: {} },
			}),
		);
		assert.doesNotThrow(() =>
			validateFinalConfig({
				...sampleValidConfig,
				dashboard: {
					customCss: ['./src/styles/lunaria.css'],
					favicon: {
						external: [{ link: 'https://lunaria.dev/favicon.svg', type: 'image/svg+xml' }],
					},
				},
			}),
		);
	});

	it('should collapse the hidden path bases', () => {
		const config = validateFinalConfig({
			...sampleValidConfig,
			dashboard: { basesToHide: ['src/content/docs/', 'src/i18n/'] },
		});

		assert.equal(getCollapsedPath(config.dashboard, 'src/content/docs/guide.mdx'), 'guide.mdx');
		assert.equal(getCollapsedPath(config.dashboard, 'src/i18n/en.yml'), 'en.yml');
		assert.equal(getCollapsedPath(config.dashboard, 'src/pages/index.mdx'), 'src/pages/index.mdx');
	});

	it('should consider dictionaries with missing keys as outdated', () => {
		const dictionary: StatusLocalizationEntry = {
			lang: 'es',
			path: 'src/i18n/es/ui.json',
			type: 'dictionary',
			status: 'up-to-date',
			git,
			contents: '',
			missingKeys: [],
		};

		assert.equal(getDashboardStatus(undefined), 'missing');
		assert.equal(getDashboardStatus({ lang: 'es', path: 'x', status: 'missing' }), 'missing');
		assert.equal(getDashboardStatus(dictionary), 'done');
		assert.equal(getDashboardStatus({ ...dictionary, status: 'outdated' }), 'outdated');
		assert.equal(getDashboardStatus({ ...dictionary, missingKeys: [['title']] }), 'outdated');
	});

	it('should join interpolated arrays in the html template', () => {
		assert.equal(
			html`<ul>${['a', 'b'].map((item) => html`<li>${item}</li>`)}</ul>`,
			'<ul><li>a</li><li>b</li></ul>',
		);
	});
});
