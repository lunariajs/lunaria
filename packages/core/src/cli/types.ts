export type Command = { name: string; description: string; usage: string; options?: Option[] };

export type Option = { name: string; description: string };

export type CLI = {
	commands: Command[];
	options: Option[];
};

export type GlobalOptions = {
	config?: string | undefined;
};

export type BuildOptions = GlobalOptions & {
	'skip-status'?: boolean | undefined;
	force?: boolean | undefined;
};

export type InitOptions = GlobalOptions;

export type PreviewOptions = GlobalOptions & {
	port?: string | undefined;
};

export type StdoutOptions = GlobalOptions & {
	force?: boolean | undefined;
};

export type PackageJson = {
	scripts?: Record<string, string>;
};
