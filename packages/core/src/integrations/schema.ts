import { z } from 'zod';
import { BaseLunariaConfigSchema, FileSchema, LocaleSchema } from '../config/schema.ts';

export const LunariaPreSetupSchema = BaseLunariaConfigSchema.extend({
	sourceLocale: LocaleSchema.optional(),
	locales: z.tuple([LocaleSchema], LocaleSchema).optional(),
	files: z.tuple([FileSchema], FileSchema).optional(),
});
