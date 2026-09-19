import type { LunariaStatus, StatusEntry, StatusLocalizationEntry } from './types.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A status entry without the tracked files' contents, as written to `status.json`. */
export type SerializedStatusEntry = DistributiveOmit<StatusEntry, 'source' | 'localizations'> & {
	source: Omit<StatusEntry['source'], 'contents'>;
	localizations: DistributiveOmit<StatusLocalizationEntry, 'contents'>[];
};

/**
 * Removes the tracked files' contents from the status, keeping the `status.json`
 * written alongside the dashboard lightweight.
 */
export function serializeStatus(status: LunariaStatus): SerializedStatusEntry[] {
	return status.map(({ source, localizations, ...entry }) => {
		const { contents: _sourceContents, ...serializedSource } = source;

		return {
			...entry,
			source: serializedSource,
			localizations: localizations.map((localization) => {
				if (localization.status === 'missing') return localization;

				const { contents: _localizationContents, ...serializedLocalization } = localization;
				return serializedLocalization;
			}),
		};
	});
}
