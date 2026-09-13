import { z } from 'zod';
import { BaseLunariaConfigSchema, FileSchema, LocaleSchema } from '../config/schema.ts';
import type { File, Locale } from '../config/types.ts';

export const LunariaPreSetupSchema = BaseLunariaConfigSchema.extend({
	sourceLocale: LocaleSchema.optional(),
	locales: z
		.array(LocaleSchema)
		.nonempty()
		.transform((items) => items as [Locale, ...Locale[]])
		.optional(),
	files: z
		.array(FileSchema)
		.nonempty()
		.transform((items) => items as [File, ...File[]])
		.optional(),
});
