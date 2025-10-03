import { z } from 'zod';

export const productSchema = z.object({
  product_id: z.number().optional(),
  vendor_id: z.number({ required_error: 'Vendor is required' }),
  product_name: z.string().min(1, 'Product name is required').max(255),
  product_code: z.string().max(50).optional(),
  description: z.string().max(5000).optional()
});

export type ProductSchema = typeof productSchema;
