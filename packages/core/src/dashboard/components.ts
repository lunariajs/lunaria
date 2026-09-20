import type { Locale, LunariaConfig } from '../config/types.ts';
import type { LunariaStatus, StatusEntry } from '../status/types.ts';
import { createGitHostingLinks, stringFromFormat } from '../utils/utils.ts';
import {
	getCollapsedPath,
	getDashboardStatus,
	getLocalization,
	getMissingKeys,
	inlineCustomCssFiles,
	readAsset,
	toISODate,
} from './helpers.ts';
import { html } from './html.ts';
import { Styles } from './styles.ts';
import type { Dashboard, DashboardStatus, DashboardUi } from './types.ts';

export const Page = (config: LunariaConfig, status: LunariaStatus): string => {
	const { dashboard, renderer } = config;

	const inlinedCssFiles = inlineCustomCssFiles(dashboard.customCss);

	return html`
		<!doctype html>
		<html dir="${dashboard.ui.dir}" lang="${dashboard.ui.lang}">
			<head>
				<!-- Built-in/custom meta tags -->
				${renderer.overrides.meta?.(config) ?? Meta(dashboard)}
				<!-- Additional head tags -->
				${renderer.slots.head?.(config) ?? ''}
				<!-- Built-in styles -->
				${Styles}
				<!-- Custom styles -->
				${
					inlinedCssFiles?.map(
						(css) =>
							html`<style>
							${css}
						</style>`,
					) ?? ''
				}
			</head>
			<body>
				<!-- Built-in/custom body content -->
				${renderer.overrides.body?.(config, status) ?? Body(config, status)}
			</body>
		</html>
	`;
};

export const Meta = (dashboard: Dashboard): string => html`
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1" />
	<title>${dashboard.title}</title>
	<meta name="description" content="${dashboard.description}" />
	${dashboard.site ? html`<link rel="canonical" href="${dashboard.site}" />` : ''}
	<meta property="og:title" content="${dashboard.title}" />
	<meta property="og:type" content="website" />
	${dashboard.site ? html`<meta property="og:url" content="${dashboard.site}" />` : ''}
	<meta property="og:description" content="${dashboard.description}" />
	${Favicon(dashboard)}
`;

export const Favicon = (dashboard: Dashboard): string => {
	const { favicon } = dashboard;

	const svg = favicon?.inline ? readAsset(favicon.inline) : '';
	const inlineSvg = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

	const ExternalFavicon = favicon?.external
		? html`${favicon.external.map(
				(icon) => html`<link rel="icon" href="${icon.link}" type="${icon.type}" />`,
			)}`
		: '';

	const InlineFavicon = favicon?.inline ? html`<link rel="icon" href="${inlineSvg}" />` : '';

	return html`${ExternalFavicon} ${InlineFavicon}`;
};

export const Body = (config: LunariaConfig, status: LunariaStatus): string => {
	const { dashboard, renderer } = config;

	return html`
		<main>
			${renderer.slots.beforeTitle?.(config) ?? ''}
			<h1>${dashboard.title}</h1>
			${renderer.slots.afterTitle?.(config) ?? ''}
			${renderer.overrides.statusByLocale?.(config, status) ?? StatusByLocale(config, status)}
			${renderer.slots.afterStatusByLocale?.(config) ?? ''}
			${renderer.overrides.statusByFile?.(config, status) ?? StatusByFile(config, status)}
			${renderer.slots.afterStatusByFile?.(config) ?? ''}
		</main>
	`;
};

export const StatusByLocale = (config: LunariaConfig, status: LunariaStatus): string => {
	const { dashboard, locales } = config;

	return html`
		<h2 id="by-locale">
			<a href="#by-locale">${dashboard.ui['statusByLocale.heading']}</a>
		</h2>
		${locales.map((locale) => LocaleDetails(config, status, locale))}
	`;
};

export const LocaleDetails = (
	config: LunariaConfig,
	status: LunariaStatus,
	locale: Locale,
): string => {
	const { dashboard } = config;
	const { label, lang } = locale;
	const links = createGitHostingLinks(config.repository);

	const missingFiles = status.filter(
		(entry) => getDashboardStatus(getLocalization(entry, lang)) === 'missing',
	);
	const outdatedFiles = status.filter(
		(entry) => getDashboardStatus(getLocalization(entry, lang)) === 'outdated',
	);

	const doneLength = status.length - outdatedFiles.length - missingFiles.length;

	return html`
		<details class="progress-details">
			<summary>
				<strong
					>${stringFromFormat(dashboard.ui['statusByLocale.detailsTitleFormat'], {
						'{locale_name}': label,
						'{locale_tag}': lang,
					})}</strong
				>
				<br />
				<span class="progress-summary"
					>${stringFromFormat(dashboard.ui['statusByLocale.detailsSummaryFormat'], {
						'{done_amount}': doneLength.toString(),
						'{done_word}': dashboard.ui['status.done'],
						'{outdated_amount}': outdatedFiles.length.toString(),
						'{outdated_word}': dashboard.ui['status.outdated'],
						'{missing_amount}': missingFiles.length.toString(),
						'{missing_word}': dashboard.ui['status.missing'],
					})}</span
				>
				<br />
				${ProgressBar(status.length, outdatedFiles.length, missingFiles.length)}
			</summary>
			${outdatedFiles.length > 0 ? OutdatedFiles(config, outdatedFiles, lang) : ''}
			${
				missingFiles.length > 0
					? html`<h3 class="capitalize">${dashboard.ui['status.missing']}</h3>
						<ul>
							${missingFiles.map((entry) => {
								const localization = getLocalization(entry, lang);

								return html`
									<li>
										${Link(
											links.source(entry.source.path),
											getCollapsedPath(dashboard, entry.source.path),
										)}
										${
											localization
												? CreateFileLink(
														links.create(localization.path),
														dashboard.ui['statusByLocale.createFileLink'],
													)
												: ''
										}
									</li>
								`;
							})}
						</ul>`
					: ''
			}
			${
				missingFiles.length === 0 && outdatedFiles.length === 0
					? html`<p>${dashboard.ui['statusByLocale.completeLocalization']}</p>`
					: ''
			}
		</details>
	`;
};

export const OutdatedFiles = (
	config: LunariaConfig,
	outdatedFiles: LunariaStatus,
	lang: string,
): string => {
	const { dashboard } = config;

	return html`
		<h3 class="capitalize">${dashboard.ui['status.outdated']}</h3>
		<ul>
			${outdatedFiles.map((entry) => {
				const missingKeys = getMissingKeys(getLocalization(entry, lang));

				return html`
					<li>
						${
							missingKeys.length > 0
								? html`
									<details>
										<summary>${ContentDetailsLinks(config, entry, lang)}</summary>
										<h4>${dashboard.ui['statusByLocale.missingKeys']}</h4>
										<ul>
											${missingKeys.map((key) => html`<li>${key}</li>`)}
										</ul>
									</details>
								`
								: html` ${ContentDetailsLinks(config, entry, lang)} `
						}
					</li>
				`;
			})}
		</ul>
	`;
};

export const StatusByFile = (config: LunariaConfig, status: LunariaStatus): string => {
	const { dashboard, locales } = config;

	return html`
		<h2 id="by-file">
			<a href="#by-file">${dashboard.ui['statusByFile.heading']}</a>
		</h2>
		<div class="table-wrapper" role="region" aria-labelledby="by-file" tabindex="0">
			<table class="status-by-file">
				<thead>
					<tr>
						${[dashboard.ui['statusByFile.tableRowFile'], ...locales.map(({ lang }) => lang)].map(
							(col) => html`<th>${col}</th>`,
						)}
					</tr>
				</thead>
				${TableBody(config, status)}
			</table>
		</div>
		<sup class="capitalize"
			>${stringFromFormat(dashboard.ui['statusByFile.tableSummaryFormat'], {
				'{missing_emoji}': dashboard.ui['status.emojiMissing'],
				'{missing_word}': dashboard.ui['status.missing'],
				'{outdated_emoji}': dashboard.ui['status.emojiOutdated'],
				'{outdated_word}': dashboard.ui['status.outdated'],
				'{done_emoji}': dashboard.ui['status.emojiDone'],
				'{done_word}': dashboard.ui['status.done'],
			})}
		</sup>
	`;
};

export const TableBody = (config: LunariaConfig, status: LunariaStatus): string => {
	const { dashboard, locales } = config;
	const links = createGitHostingLinks(config.repository);

	// TODO(HiDeoo) Revert changes to this component.
	return html`
		<tbody>
			${Array.from({ length: 50 }, () => status)
				.flat()
				.map(
					(entry) => html`
					<tr>
						<td>
							${Link(
								links.source(entry.source.path),
								getCollapsedPath(dashboard, entry.source.path),
							)}
						</td>
						${locales.map(({ lang }) => TableContentStatus(config, entry, lang))}
					</tr>
				`,
				)}
		</tbody>
	`;
};

export const TableContentStatus = (
	config: LunariaConfig,
	entry: StatusEntry,
	lang: string,
): string => {
	const links = createGitHostingLinks(config.repository);
	const localization = getLocalization(entry, lang);
	const status = getDashboardStatus(localization);

	const href = !localization
		? null
		: localization.status === 'missing'
			? links.create(localization.path)
			: links.source(localization.path);

	return html`<td>${EmojiFileLink(config.dashboard.ui, href, status)}</td>`;
};

export const ContentDetailsLinks = (
	config: LunariaConfig,
	entry: StatusEntry,
	lang: string,
): string => {
	const { dashboard } = config;
	const links = createGitHostingLinks(config.repository);
	const localization = getLocalization(entry, lang);

	const SourceLink = Link(
		links.source(entry.source.path),
		getCollapsedPath(dashboard, entry.source.path),
	);

	if (!localization || localization.status === 'missing') return SourceLink;

	const isMissingKeys = getMissingKeys(localization).length > 0;

	return html`
		${SourceLink}
		(${Link(
			links.source(localization.path),
			isMissingKeys
				? dashboard.ui['statusByLocale.incompleteLocalizationLink']
				: dashboard.ui['statusByLocale.outdatedLocalizationLink'],
		)},
		${Link(
			links.history(entry.source.path, toISODate(localization.git.latestTrackedCommit.date)),
			dashboard.ui['statusByLocale.sourceChangeHistoryLink'],
		)})
	`;
};

export const EmojiFileLink = (
	ui: DashboardUi,
	href: string | null,
	type: DashboardStatus,
): string => {
	const statusTextOpts = {
		missing: 'status.missing',
		outdated: 'status.outdated',
		done: 'status.done',
	} as const;

	const statusEmojiOpts = {
		missing: 'status.emojiMissing',
		outdated: 'status.emojiOutdated',
		done: 'status.emojiDone',
	} as const;

	return href
		? html`<a href="${href}" title="${ui[statusTextOpts[type]]}">
				<span aria-hidden="true">${ui[statusEmojiOpts[type]]}</span>
			</a>`
		: html`<span title="${ui[statusTextOpts[type]]}">
				<span aria-hidden="true">${ui[statusEmojiOpts[type]]}</span>
			</span>`;
};

export const Link = (href: string, text: string): string => {
	return html`<a href="${href}">${text}</a>`;
};

export const CreateFileLink = (href: string, text: string): string => {
	return html`<a class="create-button" href="${href}">${text}</a>`;
};

export const ProgressBar = (
	total: number,
	outdated: number,
	missing: number,
	{ size = 20 }: { size?: number } = {},
): string => {
	const outdatedSize = Math.round((outdated / total) * size);
	const missingSize = Math.round((missing / total) * size);
	const doneSize = size - outdatedSize - missingSize;

	const getBlocks = (size: number, type: DashboardStatus) => {
		const items = [];
		for (let i = 0; i < size; i++) {
			items.push(html`<div class="${type}-bar"></div>`);
		}
		return items;
	};

	return html`
		<div class="progress-bar" aria-hidden="true">
			${getBlocks(doneSize, 'done')} ${getBlocks(outdatedSize, 'outdated')}
			${getBlocks(missingSize, 'missing')}
		</div>
	`;
};
