import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { versionSchema } from '$lib/schemas/version';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(versionSchema));
  
  const versionsResult = await db.query(`
    SELECT 
      sv.version_id,
      sv.version_string,
      sv.version_major,
      sv.version_minor,
      sv.version_patch,
      sv.release_date,
      sv.notes,
      sv.product_id,
      p.product_name,
      p.product_code,
      v.vendor_id,
      v.vendor_name,
      v.vendor_code,
      sv.created_at
    FROM software_versions sv
    JOIN software_products p ON sv.product_id = p.product_id
    JOIN vendors v ON p.vendor_id = v.vendor_id
    ORDER BY v.vendor_name, p.product_name, sv.version_major DESC, 
             sv.version_minor DESC, sv.version_patch DESC
  `);
  
  const productsResult = await db.query(`
    SELECT 
      p.product_id,
      p.product_name,
      p.product_code,
      v.vendor_name,
      v.vendor_code
    FROM software_products p
    JOIN vendors v ON p.vendor_id = v.vendor_id
    ORDER BY v.vendor_name, p.product_name
  `);
  
  return {
    form,
    versions: versionsResult.rows,
    products: productsResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(versionSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      const productCheck = await db.query(
        'SELECT product_id FROM software_products WHERE product_id = $1',
        [form.data.product_id]
      );
      
      if (productCheck.rows.length === 0) {
        return fail(400, {
          form,
          message: 'Selected product does not exist'
        });
      }
      
      const existing = await db.query(
        `SELECT version_id FROM software_versions 
         WHERE product_id = $1 
         AND version_major = $2 
         AND COALESCE(version_minor, 0) = COALESCE($3, 0)
         AND COALESCE(version_patch, 0) = COALESCE($4, 0)`,
        [
          form.data.product_id,
          form.data.version_major,
          form.data.version_minor,
          form.data.version_patch
        ]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A version with these numbers already exists for this product'
        });
      }
      
      await db.query(
        `INSERT INTO software_versions 
         (product_id, version_string, version_major, version_minor, version_patch, release_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          form.data.product_id,
          form.data.version_string,
          form.data.version_major,
          form.data.version_minor || null,
          form.data.version_patch || null,
          form.data.release_date || null,
          form.data.notes || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Version created successfully'
      };
    } catch (error) {
      console.error('Error creating version:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the version'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(versionSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.version_id) {
      return fail(400, { form, message: 'Version ID is required for update' });
    }
    
    try {
      const versionCheck = await db.query(
        'SELECT version_id FROM software_versions WHERE version_id = $1',
        [form.data.version_id]
      );
      
      if (versionCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Version not found'
        });
      }
      
      const productCheck = await db.query(
        'SELECT product_id FROM software_products WHERE product_id = $1',
        [form.data.product_id]
      );
      
      if (productCheck.rows.length === 0) {
        return fail(400, {
          form,
          message: 'Selected product does not exist'
        });
      }
      
      const existing = await db.query(
        `SELECT version_id FROM software_versions 
         WHERE product_id = $1 
         AND version_major = $2 
         AND COALESCE(version_minor, 0) = COALESCE($3, 0)
         AND COALESCE(version_patch, 0) = COALESCE($4, 0)
         AND version_id != $5`,
        [
          form.data.product_id,
          form.data.version_major,
          form.data.version_minor,
          form.data.version_patch,
          form.data.version_id
        ]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A version with these numbers already exists for this product'
        });
      }
      
      await db.query(
        `UPDATE software_versions 
         SET product_id = $1,
             version_string = $2,
             version_major = $3,
             version_minor = $4,
             version_patch = $5,
             release_date = $6,
             notes = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE version_id = $8`,
        [
          form.data.product_id,
          form.data.version_string,
          form.data.version_major,
          form.data.version_minor || null,
          form.data.version_patch || null,
          form.data.release_date || null,
          form.data.notes || null,
          form.data.version_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Version updated successfully'
      };
    } catch (error) {
      console.error('Error updating version:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the version'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const versionIds = formData.get('version_ids');
    
    if (!versionIds) {
      return fail(400, { message: 'No versions selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(versionIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No versions selected for deletion' });
      }
      
      const installationsCheck = await db.query(
        `SELECT 
           sv.version_string,
           p.product_name,
           COUNT(li.installation_id) as installation_count
         FROM software_versions sv
         JOIN software_products p ON sv.product_id = p.product_id
         LEFT JOIN lpar_installations li ON sv.version_id = li.version_id
         WHERE sv.version_id = ANY($1::int[])
         GROUP BY sv.version_id, sv.version_string, p.product_name
         HAVING COUNT(li.installation_id) > 0`,
        [ids]
      );
      
      if (installationsCheck.rows.length > 0) {
        const versionNames = installationsCheck.rows
          .map(r => `${r.product_name} ${r.version_string}`)
          .join(', ');
        return fail(400, {
          message: `Cannot delete versions with installations: ${versionNames}. Remove installations first.`
        });
      }
      
      await db.query(
        'DELETE FROM package_contents WHERE version_id = ANY($1::int[])',
        [ids]
      );
      
      await db.query(
        'DELETE FROM software_versions WHERE version_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} version${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting versions:', error);
      return fail(500, {
        message: 'An error occurred while deleting versions'
      });
    }
  }
};
