import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { packageSchema } from '$lib/schemas/package';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(packageSchema));
  
  const packagesResult = await db.query(`
    SELECT 
      p.package_id,
      p.package_name,
      p.package_version,
      p.build_date,
      p.description,
      p.created_at,
      COUNT(pc.version_id) as content_count
    FROM software_packages p
    LEFT JOIN package_contents pc ON p.package_id = pc.package_id
    GROUP BY p.package_id, p.package_name, p.package_version, p.build_date, 
             p.description, p.created_at
    ORDER BY p.build_date DESC, p.package_name
  `);
  
  return {
    form,
    packages: packagesResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(packageSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      const existing = await db.query(
        'SELECT package_id FROM software_packages WHERE LOWER(package_name) = LOWER($1) AND LOWER(package_version) = LOWER($2)',
        [form.data.package_name, form.data.package_version]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A package with this name and version already exists'
        });
      }
      
      await db.query(
        `INSERT INTO software_packages (package_name, package_version, build_date, description)
         VALUES ($1, $2, $3, $4)`,
        [
          form.data.package_name,
          form.data.package_version,
          form.data.build_date,
          form.data.description || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Package created successfully'
      };
    } catch (error) {
      console.error('Error creating package:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the package'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(packageSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.package_id) {
      return fail(400, { form, message: 'Package ID is required for update' });
    }
    
    try {
      const packageCheck = await db.query(
        'SELECT package_id FROM software_packages WHERE package_id = $1',
        [form.data.package_id]
      );
      
      if (packageCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Package not found'
        });
      }
      
      const existing = await db.query(
        'SELECT package_id FROM software_packages WHERE LOWER(package_name) = LOWER($1) AND LOWER(package_version) = LOWER($2) AND package_id != $3',
        [form.data.package_name, form.data.package_version, form.data.package_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A package with this name and version already exists'
        });
      }
      
      await db.query(
        `UPDATE software_packages 
         SET package_name = $1, 
             package_version = $2, 
             build_date = $3,
             description = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE package_id = $5`,
        [
          form.data.package_name,
          form.data.package_version,
          form.data.build_date,
          form.data.description || null,
          form.data.package_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Package updated successfully'
      };
    } catch (error) {
      console.error('Error updating package:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the package'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const packageIds = formData.get('package_ids');
    
    if (!packageIds) {
      return fail(400, { message: 'No packages selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(packageIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No packages selected for deletion' });
      }
      
      await db.query(
        'DELETE FROM package_contents WHERE package_id = ANY($1::int[])',
        [ids]
      );
      
      await db.query(
        'DELETE FROM software_packages WHERE package_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} package${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting packages:', error);
      return fail(500, {
        message: 'An error occurred while deleting packages'
      });
    }
  }
};
