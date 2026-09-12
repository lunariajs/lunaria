export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type RegExpGroups<T extends string> =
	| (RegExpMatchArray & {
			groups?: { [name in T]: string } | { [key: string]: string };
	  })
	| null;
