import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { suiteSchema } from '$lib/schemas/suite';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(suiteSchema));
  
  const suitesResult = await db.query(`
    SELECT 
      s.suite_id,
      s.suite_name,
      s.suite_version,
      s.description,
      s.vendor_id,
      v.vendor_name,
      v.vendor_code,
      s.created_at,
      COUNT(sp.product_id) as product_count
    FROM software_suites s
    LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
    LEFT JOIN suite_products sp ON s.suite_id = sp.suite_id
    GROUP BY s.suite_id, s.suite_name, s.suite_version, s.description,
             s.vendor_id, v.vendor_name, v.vendor_code, s.created_at
    ORDER BY s.suite_name, s.suite_version DESC
  `);
  
  const vendorsResult = await db.query(`
    SELECT vendor_id, vendor_name, vendor_code
    FROM vendors
    ORDER BY vendor_name
  `);
  
  return {
    form,
    suites: suitesResult.rows,
    vendors: vendorsResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(suiteSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      if (form.data.vendor_id) {
        const vendorCheck = await db.query(
          'SELECT vendor_id FROM vendors WHERE vendor_id = $1',
          [form.data.vendor_id]
        );
        
        if (vendorCheck.rows.length === 0) {
          return fail(400, {
            form,
            message: 'Selected vendor does not exist'
          });
        }
      }
      
      const existing = await db.query(
        'SELECT suite_id FROM software_suites WHERE LOWER(suite_name) = LOWER($1) AND LOWER(suite_version) = LOWER($2)',
        [form.data.suite_name, form.data.suite_version]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A suite with this name and version already exists'
        });
      }
      
      await db.query(
        `INSERT INTO software_suites (suite_name, suite_version, description, vendor_id)
         VALUES ($1, $2, $3, $4)`,
        [
          form.data.suite_name,
          form.data.suite_version,
          form.data.description || null,
          form.data.vendor_id || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Suite created successfully'
      };
    } catch (error) {
      console.error('Error creating suite:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the suite'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(suiteSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.suite_id) {
      return fail(400, { form, message: 'Suite ID is required for update' });
    }
    
    try {
      const suiteCheck = await db.query(
        'SELECT suite_id FROM software_suites WHERE suite_id = $1',
        [form.data.suite_id]
      );
      
      if (suiteCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Suite not found'
        });
      }
      
      if (form.data.vendor_id) {
        const vendorCheck = await db.query(
          'SELECT vendor_id FROM vendors WHERE vendor_id = $1',
          [form.data.vendor_id]
        );
        
        if (vendorCheck.rows.length === 0) {
          return fail(400, {
            form,
            message: 'Selected vendor does not exist'
          });
        }
      }
      
      const existing = await db.query(
        'SELECT suite_id FROM software_suites WHERE LOWER(suite_name) = LOWER($1) AND LOWER(suite_version) = LOWER($2) AND suite_id != $3',
        [form.data.suite_name, form.data.suite_version, form.data.suite_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A suite with this name and version already exists'
        });
      }
      
      await db.query(
        `UPDATE software_suites 
         SET suite_name = $1, 
             suite_version = $2, 
             description = $3,
             vendor_id = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE suite_id = $5`,
        [
          form.data.suite_name,
          form.data.suite_version,
          form.data.description || null,
          form.data.vendor_id || null,
          form.data.suite_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Suite updated successfully'
      };
    } catch (error) {
      console.error('Error updating suite:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the suite'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const suiteIds = formData.get('suite_ids');
    
    if (!suiteIds) {
      return fail(400, { message: 'No suites selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(suiteIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No suites selected for deletion' });
      }
      
      await db.query(
        'DELETE FROM suite_products WHERE suite_id = ANY($1::int[])',
        [ids]
      );
      
      await db.query(
        'DELETE FROM software_suites WHERE suite_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} suite${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting suites:', error);
      return fail(500, {
        message: 'An error occurred while deleting suites'
      });
    }
  }
};
