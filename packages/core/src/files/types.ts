export interface PathResolver {
	/** Checks if a path matches an source locale path. */
	isSourcePath: (path: string) => boolean;
	/** Checks if a path matches an localized path. */
	isLocalesPath: (path: string) => boolean;
	/** Creates a path from one locale to the equivalent of another. */
	toPath: (fromPath: string, toLang: string) => string;
	/** The resolved source pattern used by the path resolver. */
	sourcePattern: string;
	/** The resolved locales pattern used by the path resolver. */
	localesPattern: string;
}
