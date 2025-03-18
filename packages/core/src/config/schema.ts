import type { Consola, InputLogObject, LogType } from 'consola';
import { z } from 'zod';
import { isRelative, stripTrailingSlash } from '../utils/utils.ts';
import type { LunariaUserConfig, OptionalKeys } from './types.ts';

const RepositorySchema = z.object({
	name: z.string().transform((path) => stripTrailingSlash(path)),
	branch: z.string().default('main'),
	rootDir: z
		.string()
		.default('.')
		.refine((path) => !isRelative(path), {
			message:
				'The root directory should not be a relative path, it should follow the example: `examples/vitepress`',
		})
		// TODO: See if this transform is even necessary still?
		.transform((path) => stripTrailingSlash(path)),
	hosting: z.union([z.literal('github'), z.literal('gitlab')]).default('github'),
});

const BaseFileSchema = z.object({
	include: z.array(z.string()).nonempty(),
	exclude: z.array(z.string()).default(['node_modules']),
	pattern: z.union([
		z.string(),
		z.object({
			source: z.string(),
			locales: z.string(),
		}),
	]),
});

const OptionalKeysSchema: z.ZodType<OptionalKeys> = z.lazy(() =>
	z.record(z.string(), z.union([z.boolean(), OptionalKeysSchema])),
);

export const FileSchema = z.discriminatedUnion('type', [
	BaseFileSchema.extend({ type: z.literal('universal') }),
	BaseFileSchema.extend({
		type: z.literal('dictionary'),
		optionalKeys: OptionalKeysSchema.optional(),
	}),
]);

export const SetupOptionsSchema = z.object({
	config: z.any() as z.Schema<LunariaUserConfig>,
	updateConfig: z.function(
		z.tuple([z.record(z.any()) as z.Schema<Partial<LunariaUserConfig>>]),
		z.void(),
	),
	// Importing ConsolaInstance from 'consola' directly is not possible due to missing imports for `LogFn`
	logger: z.any() as z.Schema<
		Consola &
			Record<
				LogType,
				{
					// biome-ignore lint/suspicious/noExplicitAny: copied from Consola
					(message: InputLogObject | any, ...args: any[]): void;
					// biome-ignore lint/suspicious/noExplicitAny: copied from Consola
					raw: (...args: any[]) => void;
				}
			>
	>,
});

const LunariaIntegrationSchema = z.object({
	name: z.string(),
	hooks: z.object({
		setup: z.function(z.tuple([SetupOptionsSchema]), z.void()).optional(),
	}),
});

export const LocaleSchema = z.object({
	label: z.string(),
	lang: z.string(),
	parameters: z.record(z.string(), z.string()).optional(),
});

// We need both of these schemas so that we can extend the Lunaria config
// e.g. to validate integrations
export const BaseLunariaConfigSchema = z.object({
	repository: RepositorySchema,
	sourceLocale: LocaleSchema,
	locales: z.array(LocaleSchema).nonempty(),
	files: z.array(FileSchema).nonempty(),
	tracking: z
		.object({
			ignoredKeywords: z.array(z.string()).default(['lunaria-ignore', 'fix typo']),
			localizableProperty: z.string().optional(),
		})
		.default({}),
	external: z.boolean().default(false),
	integrations: z.array(LunariaIntegrationSchema).default([]),
	cacheDir: z.string().default('./node_modules/.cache/lunaria'),
	cloneDir: z.string().default('./node_modules/.cache/lunaria/history'),
});

export const LunariaConfigSchema = BaseLunariaConfigSchema.superRefine((config, ctx) => {
	// Adds an validation issue if any locales share the same value.
	const locales = new Set();
	for (const locale of [config.sourceLocale.lang, ...config.locales.map((locale) => locale.lang)]) {
		if (locales.has(locale)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Repeated \`locales\` value: \`"${locale}"\``,
			});
		}
		locales.add(locale);
	}

	let params: Array<string> | undefined = undefined;
	for (const { parameters, lang } of [config.sourceLocale, ...config.locales]) {
		// Since the sourceLocale is evaluated first in the array, we can use it
		// to ensure whe are properly checking no locales has the `parameters` field.
		if (!params && parameters && config.sourceLocale.parameters) {
			params = Object.keys(parameters);
		}

		if (parameters && Object.keys(parameters).join(',') !== params?.join(',')) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'All locales must have the same `parameters` keys',
			});
		}

		if (params && !parameters) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `All locales must have the same \`parameters\` keys. Locale ${lang} does not have \`parameters\`.`,
			});
		}
	}

	if (config.cacheDir === config.cloneDir) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: '`cacheDir` and `cloneDir` should not be in the same directory',
		});
	}
});
