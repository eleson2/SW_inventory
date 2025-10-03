import { z } from 'zod';

export const customerSchema = z.object({
  customer_id: z.number().optional(),
  customer_name: z.string().min(1, 'Customer name is required').max(255),
  customer_code: z.string().max(50).optional(),
  contact_email: z.string().email().max(255).optional().or(z.literal('')),
  contact_phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional()
});

export type CustomerSchema = typeof customerSchema;
