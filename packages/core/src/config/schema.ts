import { z } from 'zod';
import { DashboardSchema, RendererConfigSchema } from '../dashboard/schema.ts';
import type { LunariaIntegration } from '../integrations/types.ts';
import { isRelative, stripTrailingSlash } from '../utils/utils.ts';
import type { OptionalKeys } from './types.ts';

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
		.transform((path) => stripTrailingSlash(path)),
	hosting: z.enum(['github', 'gitlab']).default('github'),
});

const BaseFileSchema = z.object({
	include: z.tuple([z.string()], z.string()),
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
		merge: z.record(z.string(), z.tuple([z.string()], z.string())).optional(),
		optionalKeys: OptionalKeysSchema.optional(),
	}),
]);

const LunariaIntegrationSchema = z.object({
	name: z.string(),
	hooks: z.object({
		setup: z
			.custom<NonNullable<LunariaIntegration['hooks']['setup']>>(
				(value) => typeof value === 'function',
			)
			.optional(),
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
	locales: z.tuple([LocaleSchema], LocaleSchema),
	files: z.tuple([FileSchema], FileSchema),
	tracking: z
		.object({
			ignoredKeywords: z.array(z.string()).default(['lunaria-ignore', 'fix typo']),
			localizableProperty: z.string().optional(),
		})
		.prefault({}),
	external: z.boolean().default(false),
	integrations: z.array(LunariaIntegrationSchema).default([]),
	cacheDir: z.string().default('./node_modules/.cache/lunaria'),
	cloneDir: z.string().default('./node_modules/.cache/lunaria/history'),
	dashboard: DashboardSchema,
	renderer: RendererConfigSchema,
	outDir: z.string().default('./dist/lunaria'),
});

export const LunariaConfigSchema = BaseLunariaConfigSchema.superRefine((config, ctx) => {
	// Adds an validation issue if any locales share the same value.
	const locales = new Set();
	for (const locale of [config.sourceLocale.lang, ...config.locales.map((locale) => locale.lang)]) {
		if (locales.has(locale)) {
			ctx.addIssue({
				code: 'custom',
				message: `Repeated \`locales\` value: \`"${locale}"\``,
			});
		}
		locales.add(locale);
	}

	const sourceParameterKeys = config.sourceLocale.parameters
		? Object.keys(config.sourceLocale.parameters).sort()
		: undefined;

	for (const { parameters, lang } of [config.sourceLocale, ...config.locales]) {
		const parameterKeys = parameters ? Object.keys(parameters).sort() : undefined;

		if (!sourceParameterKeys && parameterKeys) {
			ctx.addIssue({
				code: 'custom',
				message: 'All locales must have the same `parameters` keys',
			});
		}

		if (sourceParameterKeys && !parameterKeys) {
			ctx.addIssue({
				code: 'custom',
				message: `All locales must have the same \`parameters\` keys. Locale ${lang} does not have \`parameters\``,
			});
		}

		if (
			sourceParameterKeys &&
			parameterKeys &&
			(sourceParameterKeys.length !== parameterKeys.length ||
				!sourceParameterKeys.every((parameter, index) => parameter === parameterKeys[index]))
		) {
			ctx.addIssue({
				code: 'custom',
				message: 'All locales must have the same `parameters` keys',
			});
		}
	}

	if (config.cacheDir === config.cloneDir) {
		ctx.addIssue({
			code: 'custom',
			message: '`cacheDir` and `cloneDir` should not be in the same directory',
		});
	}

	for (const file of config.files) {
		if (file.type !== 'dictionary' || !file.merge) continue;

		for (const [targetLang, baseLangs] of Object.entries(file.merge)) {
			if (!locales.has(targetLang)) {
				ctx.addIssue({
					code: 'custom',
					message: `\`merge\` key \`"${targetLang}"\` is not a configured locale lang`,
				});
			}
			for (const baseLang of baseLangs) {
				if (!locales.has(baseLang)) {
					ctx.addIssue({
						code: 'custom',
						message: `\`merge\` base lang \`"${baseLang}"\` for target \`"${targetLang}"\` is not a configured locale lang`,
					});
				}
				if (baseLang === targetLang) {
					ctx.addIssue({
						code: 'custom',
						message: `\`merge\` base lang \`"${baseLang}"\` cannot be the same as its target lang`,
					});
				}
			}
		}
	}
});
