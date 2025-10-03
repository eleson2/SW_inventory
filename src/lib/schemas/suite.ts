import { z } from 'zod';

export const suiteSchema = z.object({
  suite_id: z.number().optional(),
  suite_name: z.string().min(1, 'Suite name is required').max(255),
  suite_version: z.string().min(1, 'Suite version is required').max(50),
  description: z.string().max(5000).optional(),
  vendor_id: z.number().optional()
});

export type SuiteSchema = typeof suiteSchema;
