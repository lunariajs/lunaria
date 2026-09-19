import { extname } from 'node:path';
import { z } from 'zod';
import { isRelative } from '../utils/utils.ts';
import type { BaseComponent, StatusComponent } from './types.ts';

const DashboardUiSchema = z
	.object({
		/** The BCP-47 tag of the dashboard's UI, used as the page's `lang` attribute, e.g. `'en'` or `'pt-BR'` */
		lang: z.string().default('en'),
		/** The directionality of the page's text, used as the page's `dir` attribute. It can be either `'ltr'` (left-to-right) or `'rtl'` (right-to-left) */
		dir: z.enum(['ltr', 'rtl']).default('ltr'),
		/** The dashboard status of 'done' */
		'status.done': z.string().default('done'),
		/** The dashboard status of 'outdated' */
		'status.outdated': z.string().default('outdated'),
		/** The dashboard status 'missing' */
		'status.missing': z.string().default('missing'),
		/** The dashboard status emoji for 'done' */
		'status.emojiDone': z.string().default('✔'),
		/** The dashboard status emoji for 'outdated' */
		'status.emojiOutdated': z.string().default('🔄'),
		/** The dashboard status emoji for 'missing' */
		'status.emojiMissing': z.string().default('❌'),
		/** The heading text that precedes the dropdown lists of each locale's individual progress */
		'statusByLocale.heading': z.string().default('Localization progress by locale'),
		/**
		 * The locale's individual status details summary format. The `{*_amount}` and `{*_word}`
		 * are placeholder values for the amount of files (e.g. '10') in the status and the status word
		 * (e.g. 'done'), respectively.
		 */
		'statusByLocale.detailsSummaryFormat': z
			.string()
			.default(
				'{done_amount} {done_word}, {outdated_amount} {outdated_word}, {missing_amount} {missing_word}',
			),
		/**
		 * The locale's details title format. The `{locale_name}` and `{locale_tag}` are placeholder values
		 * for the locale's name (e.g. English) and the locale's BCP-47 tag (e.g. en), respectively.
		 */
		'statusByLocale.detailsTitleFormat': z.string().default('{locale_name} ({locale_tag})'),
		/** The text for the locale's details outdated localization link */
		'statusByLocale.outdatedLocalizationLink': z.string().default('outdated localization'),
		/** The text for the locale's details incomplete localization link */
		'statusByLocale.incompleteLocalizationLink': z.string().default('incomplete localization'),
		/** The text for the locale's details create file link */
		'statusByLocale.createFileLink': z.string().default('Create file'),
		/** The text for the locale's details source change history link */
		'statusByLocale.sourceChangeHistoryLink': z.string().default('source change history'),
		/** The text for the locale's details UI dictionary missing keys heading */
		'statusByLocale.missingKeys': z.string().default('Missing keys'),
		/** The text shown in the locale's details when it is complete */
		'statusByLocale.completeLocalization': z
			.string()
			.default('This localization is complete, amazing job! 🎉'),
		/** The heading text that precedes the table with all locale's status by file */
		'statusByFile.heading': z.string().default('Localization status by file'),
		/** The text for the status dashboard table's 'file' row head */
		'statusByFile.tableRowFile': z.string().default('File'),
		/** The dashboard table's summary format. The `{*_emoji}` and `{*_word}` are placeholder values for the status emoji (e.g. '❌') and its word (e.g. 'missing') */
		'statusByFile.tableSummaryFormat': z
			.string()
			.default(
				'{missing_emoji} {missing_word} &nbsp; {outdated_emoji} {outdated_word} &nbsp; {done_emoji} {done_word}',
			),
	})
	.prefault({});

export const DashboardSchema = z
	.object({
		/** The title of your localization dashboard, used as both the main heading and meta title of the page */
		title: z.string().default('Localization Status'),
		/** The description of your localization dashboard, used in the meta tags of the page */
		description: z.string().default('Online localization status dashboard of the project'),
		/** The deployed URL of your localization dashboard, used in the meta tags of the page */
		site: z.url().optional(),
		/** Array of path bases to hide from the rendered dashboard links */
		basesToHide: z.array(z.string()).optional(),
		/** Array of relative paths to CSS files to be inlined into the dashboard */
		customCss: z
			.array(z.string())
			.optional()
			.refine(
				(paths) =>
					paths ? paths.every((path) => isRelative(path) && extname(path) === '.css') : true,
				{
					message: 'All `customCss` paths should be relative and point to a `.css` file',
				},
			),
		/** The favicon(s) to be used by your dashboard */
		favicon: z
			.object({
				/** Array of the external favicon(s) to be used */
				external: z
					.array(
						z.object({
							/** The URL of the external favicon asset */
							link: z.url(),
							/** The type attribute of the favicon, e.g. `"image/x-icon"` or `"image/svg+xml"` */
							type: z.string(),
						}),
					)
					.nonempty()
					.optional(),
				/** Path to an SVG to be inlined into the dashboard */
				inline: z
					.string()
					.refine((path) => isRelative(path) && extname(path) === '.svg', {
						message:
							'The `favicon.inline` path should be relative and point to a valid `.svg` file',
					})
					.optional(),
			})
			.optional()
			.refine((props) => !props || props.external || props.inline, {
				message:
					'The `favicon` object needs to receive either a valid `inline` or `external` property',
			}),
		/** UI dictionary of the dashboard, including the desired `lang` and `dir` attributes of the page */
		ui: DashboardUiSchema,
	})
	.prefault({});

const BaseComponentSchema = z
	.custom<BaseComponent>((value: unknown) => typeof value === 'function')
	.optional();
const StatusComponentSchema = z
	.custom<StatusComponent>((value: unknown) => typeof value === 'function')
	.optional();

export const RendererConfigSchema = z
	.object({
		slots: z
			.object({
				head: BaseComponentSchema,
				beforeTitle: BaseComponentSchema,
				afterTitle: BaseComponentSchema,
				afterStatusByLocale: BaseComponentSchema,
				afterStatusByFile: BaseComponentSchema,
			})
			.prefault({}),
		overrides: z
			.object({
				meta: BaseComponentSchema,
				body: StatusComponentSchema,
				statusByLocale: StatusComponentSchema,
				statusByFile: StatusComponentSchema,
			})
			.prefault({}),
	})
	.prefault({});
