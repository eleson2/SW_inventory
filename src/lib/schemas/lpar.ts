import { z } from 'zod';

export const lparSchema = z.object({
  lpar_id: z.number().optional(),
  customer_id: z.number({ required_error: 'Customer is required' }),
  lpar_name: z.string().min(1, 'LPAR name is required').max(255),
  lpar_code: z.string().max(50).optional(),
  hostname: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(5000).optional()
});

export type LparSchema = typeof lparSchema;
