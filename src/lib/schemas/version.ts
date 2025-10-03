import { z } from 'zod';

export const versionSchema = z.object({
  version_id: z.number().optional(),
  product_id: z.number({ required_error: 'Product is required' }),
  version_string: z.string().min(1, 'Version string is required').max(100),
  version_major: z.number({ required_error: 'Major version is required' }),
  version_minor: z.number().optional(),
  version_patch: z.number().optional(),
  release_date: z.string().optional(),
  notes: z.string().max(5000).optional()
});

export type VersionSchema = typeof versionSchema;
