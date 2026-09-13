import type { LunariaStatus, StatusEntry, StatusLocalizationEntry } from './types.ts';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type SerializedStatusEntry = DistributiveOmit<StatusEntry, 'source' | 'localizations'> & {
	source: Omit<StatusEntry['source'], 'contents'>;
	localizations: DistributiveOmit<StatusLocalizationEntry, 'contents'>[];
};

export type SerializedStatus = SerializedStatusEntry[];

/**
 * Removes the tracked files' contents from the status, keeping the output written
 * to disk or logged to the console lightweight.
 */
export function serializeStatus(status: LunariaStatus): SerializedStatus {
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
