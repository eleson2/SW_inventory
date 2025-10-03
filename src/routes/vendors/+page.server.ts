import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { vendorSchema } from '$lib/schemas/vendor';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(vendorSchema));
  
  const vendorsResult = await db.query(`
    SELECT 
      v.vendor_id,
      v.vendor_name,
      v.vendor_code,
      v.website,
      v.notes,
      v.created_at,
      COUNT(p.product_id) as product_count
    FROM vendors v
    LEFT JOIN software_products p ON v.vendor_id = p.vendor_id
    GROUP BY v.vendor_id, v.vendor_name, v.vendor_code, v.website, v.notes, v.created_at
    ORDER BY v.vendor_name
  `);
  
  return {
    form,
    vendors: vendorsResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(vendorSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      const existing = await db.query(
        'SELECT vendor_id FROM vendors WHERE LOWER(vendor_name) = LOWER($1)',
        [form.data.vendor_name]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A vendor with this name already exists'
        });
      }
      
      await db.query(
        `INSERT INTO vendors (vendor_name, vendor_code, website, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          form.data.vendor_name,
          form.data.vendor_code || null,
          form.data.website || null,
          form.data.notes || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Vendor created successfully'
      };
    } catch (error) {
      console.error('Error creating vendor:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the vendor'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(vendorSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.vendor_id) {
      return fail(400, { form, message: 'Vendor ID is required for update' });
    }
    
    try {
      const vendorCheck = await db.query(
        'SELECT vendor_id FROM vendors WHERE vendor_id = $1',
        [form.data.vendor_id]
      );
      
      if (vendorCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Vendor not found'
        });
      }
      
      const existing = await db.query(
        'SELECT vendor_id FROM vendors WHERE LOWER(vendor_name) = LOWER($1) AND vendor_id != $2',
        [form.data.vendor_name, form.data.vendor_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A vendor with this name already exists'
        });
      }
      
      await db.query(
        `UPDATE vendors 
         SET vendor_name = $1, 
             vendor_code = $2, 
             website = $3,
             notes = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE vendor_id = $5`,
        [
          form.data.vendor_name,
          form.data.vendor_code || null,
          form.data.website || null,
          form.data.notes || null,
          form.data.vendor_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Vendor updated successfully'
      };
    } catch (error) {
      console.error('Error updating vendor:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the vendor'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const vendorIds = formData.get('vendor_ids');
    
    if (!vendorIds) {
      return fail(400, { message: 'No vendors selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(vendorIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No vendors selected for deletion' });
      }
      
      const productsCheck = await db.query(
        `SELECT v.vendor_name, COUNT(p.product_id) as product_count
         FROM vendors v
         LEFT JOIN software_products p ON v.vendor_id = p.vendor_id
         WHERE v.vendor_id = ANY($1::int[])
         GROUP BY v.vendor_id, v.vendor_name
         HAVING COUNT(p.product_id) > 0`,
        [ids]
      );
      
      if (productsCheck.rows.length > 0) {
        const vendorNames = productsCheck.rows.map(r => r.vendor_name).join(', ');
        return fail(400, {
          message: `Cannot delete vendors with products: ${vendorNames}. Remove products first.`
        });
      }
      
      await db.query(
        'DELETE FROM vendors WHERE vendor_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} vendor${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting vendors:', error);
      return fail(500, {
        message: 'An error occurred while deleting vendors'
      });
    }
  }
};
