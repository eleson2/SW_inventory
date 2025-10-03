import { z } from 'zod';

export const vendorSchema = z.object({
  vendor_id: z.number().optional(),
  vendor_name: z.string().min(1, 'Vendor name is required').max(255),
  vendor_code: z.string().max(50).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  notes: z.string().max(5000).optional()
});

export type VendorSchema = typeof vendorSchema;
