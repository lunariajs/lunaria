import type {
	DictionaryFileEntry,
	EntryFileType,
	File,
	UniversalFileEntry,
} from '../config/types.ts';

export type Dictionary = {
	[k: string]: string | Dictionary;
};

export type KeyPath = string[];

export type Commit = {
	author: {
		name: string;
		email: string;
	};
	message: string;
	body: string;
	date: Date;
	hash: string;
	refs: string;
};

export type FileGitData = {
	latestCommit: Commit;
	latestTrackedCommit: Commit;
};

type MissingStatus = 'missing';
type OutdatedStatus = 'outdated';
type UpToDateStatus = 'up-to-date';
type FileStatus = MissingStatus | OutdatedStatus | UpToDateStatus;

type BaseLocalizationEntry = {
	lang: string;
	path: string;
	status: FileStatus;
};

type MissingLocalizationEntry = BaseLocalizationEntry & { status: MissingStatus };

type ExistingLocalizationEntry = BaseLocalizationEntry & {
	type: EntryFileType;
	git: FileGitData;
	status: OutdatedStatus | UpToDateStatus;
	contents: string;
};

type UniversalLocalizationEntry = ExistingLocalizationEntry & {
	type: UniversalFileEntry;
};

type DictionaryLocalizationEntry = ExistingLocalizationEntry & {
	type: DictionaryFileEntry;
	missingKeys: KeyPath[];
};

export type StatusLocalizationEntry<T extends EntryFileType = EntryFileType> =
	| MissingLocalizationEntry
	| (T extends 'dictionary' ? DictionaryLocalizationEntry : UniversalLocalizationEntry);

export type StatusEntry<T extends EntryFileType = EntryFileType> = File & {
	source: {
		path: string;
		lang: string;
		git: FileGitData;
		contents: string;
	};
	localizations: StatusLocalizationEntry<T>[];
};

export type LunariaStatus = StatusEntry[];
