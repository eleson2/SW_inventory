import { z } from 'zod';

export const packageSchema = z.object({
  package_id: z.number().optional(),
  package_name: z.string().min(1, 'Package name is required').max(255),
  package_version: z.string().min(1, 'Package version is required').max(50),
  build_date: z.string().min(1, 'Build date is required'),
  description: z.string().max(5000).optional()
});

export type PackageSchema = typeof packageSchema;
