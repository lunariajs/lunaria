import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AssetNotFound } from '../errors/errors.ts';
import type { StatusEntry, StatusLocalizationEntry } from '../status/types.ts';
import type { Dashboard, DashboardStatus } from './types.ts';

export function readAsset(path: string) {
	const resolvedPath = resolve(path);

	if (!existsSync(resolvedPath)) {
		throw new Error(AssetNotFound.message(resolvedPath));
	}

	return readFileSync(resolvedPath, 'utf-8');
}

/** Removes the first matching `basesToHide` base from a path, e.g. to shorten the links shown in the dashboard. */
export function getCollapsedPath(dashboard: Dashboard, path: string) {
	const { basesToHide } = dashboard;

	if (!basesToHide) return path;

	for (const base of basesToHide) {
		const newPath = path.replace(base, '');

		if (newPath === path) continue;
		return newPath;
	}

	return path;
}

export function inlineCustomCssFiles(customCssPaths: Dashboard['customCss']) {
	if (!customCssPaths) return null;

	return customCssPaths.map((path) => readAsset(path));
}

/** Finds the localization of a specific locale in a status entry. */
export function getLocalization(entry: StatusEntry, lang: string) {
	return entry.localizations.find((localization) => localization.lang === lang);
}

/** Returns the missing dictionary keys of a localization as dot-separated key paths, e.g. `nav.home`. */
export function getMissingKeys(localization: StatusLocalizationEntry | undefined) {
	if (!localization || localization.status === 'missing' || localization.type !== 'dictionary') {
		return [];
	}

	return localization.missingKeys.map((keyPath) => keyPath.join('.'));
}

/**
 * Returns the status of a localization as displayed by the dashboard. Unlike the tracked status,
 * dictionaries with missing keys are considered outdated as well.
 */
export function getDashboardStatus(
	localization: StatusLocalizationEntry | undefined,
): DashboardStatus {
	if (!localization || localization.status === 'missing') return 'missing';
	if (localization.status === 'outdated' || getMissingKeys(localization).length > 0) {
		return 'outdated';
	}
	return 'done';
}

/** Converts a commit date to an ISO string, be it a `Date` or a string loaded from a status JSON file. */
export function toISODate(date: Date | string) {
	return new Date(date).toISOString();
}
