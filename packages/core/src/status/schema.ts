import { z } from 'zod';
import type { Dictionary } from './types.ts';

/** An valid dictionary is any recursively nested object with string values. */
export const DictionarySchema: z.ZodType<Dictionary> = z.lazy(() =>
	z.record(z.string(), z.union([z.string(), DictionarySchema])),
);
