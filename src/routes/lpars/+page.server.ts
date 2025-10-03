import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { lparSchema } from '$lib/schemas/lpar';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(lparSchema));
  
  const lparsResult = await db.query(`
    SELECT 
      l.lpar_id,
      l.lpar_name,
      l.lpar_code,
      l.hostname,
      l.is_active,
      l.notes,
      l.customer_id,
      c.customer_name,
      c.customer_code,
      l.created_at,
      COUNT(li.installation_id) as installation_count
    FROM lpars l
    JOIN customers c ON l.customer_id = c.customer_id
    LEFT JOIN lpar_installations li ON l.lpar_id = li.lpar_id
    GROUP BY l.lpar_id, l.lpar_name, l.lpar_code, l.hostname, l.is_active,
             l.notes, l.customer_id, c.customer_name, c.customer_code, l.created_at
    ORDER BY c.customer_name, l.lpar_name
  `);
  
  const customersResult = await db.query(`
    SELECT customer_id, customer_name, customer_code
    FROM customers
    ORDER BY customer_name
  `);
  
  return {
    form,
    lpars: lparsResult.rows,
    customers: customersResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(lparSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      const customerCheck = await db.query(
        'SELECT customer_id FROM customers WHERE customer_id = $1',
        [form.data.customer_id]
      );
      
      if (customerCheck.rows.length === 0) {
        return fail(400, {
          form,
          message: 'Selected customer does not exist'
        });
      }
      
      const existing = await db.query(
        'SELECT lpar_id FROM lpars WHERE LOWER(lpar_name) = LOWER($1)',
        [form.data.lpar_name]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'An LPAR with this name already exists'
        });
      }
      
      await db.query(
        `INSERT INTO lpars (customer_id, lpar_name, lpar_code, hostname, is_active, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          form.data.customer_id,
          form.data.lpar_name,
          form.data.lpar_code || null,
          form.data.hostname || null,
          form.data.is_active ?? true,
          form.data.notes || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'LPAR created successfully'
      };
    } catch (error) {
      console.error('Error creating LPAR:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the LPAR'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(lparSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.lpar_id) {
      return fail(400, { form, message: 'LPAR ID is required for update' });
    }
    
    try {
      const lparCheck = await db.query(
        'SELECT lpar_id FROM lpars WHERE lpar_id = $1',
        [form.data.lpar_id]
      );
      
      if (lparCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'LPAR not found'
        });
      }
      
      const customerCheck = await db.query(
        'SELECT customer_id FROM customers WHERE customer_id = $1',
        [form.data.customer_id]
      );
      
      if (customerCheck.rows.length === 0) {
        return fail(400, {
          form,
          message: 'Selected customer does not exist'
        });
      }
      
      const existing = await db.query(
        'SELECT lpar_id FROM lpars WHERE LOWER(lpar_name) = LOWER($1) AND lpar_id != $2',
        [form.data.lpar_name, form.data.lpar_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'An LPAR with this name already exists'
        });
      }
      
      await db.query(
        `UPDATE lpars 
         SET customer_id = $1,
             lpar_name = $2, 
             lpar_code = $3, 
             hostname = $4,
             is_active = $5,
             notes = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE lpar_id = $7`,
        [
          form.data.customer_id,
          form.data.lpar_name,
          form.data.lpar_code || null,
          form.data.hostname || null,
          form.data.is_active ?? true,
          form.data.notes || null,
          form.data.lpar_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'LPAR updated successfully'
      };
    } catch (error) {
      console.error('Error updating LPAR:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the LPAR'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const lparIds = formData.get('lpar_ids');
    
    if (!lparIds) {
      return fail(400, { message: 'No LPARs selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(lparIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No LPARs selected for deletion' });
      }
      
      const installationsCheck = await db.query(
        `SELECT l.lpar_name, COUNT(li.installation_id) as installation_count
         FROM lpars l
         LEFT JOIN lpar_installations li ON l.lpar_id = li.lpar_id
         WHERE l.lpar_id = ANY($1::int[])
         GROUP BY l.lpar_id, l.lpar_name
         HAVING COUNT(li.installation_id) > 0`,
        [ids]
      );
      
      if (installationsCheck.rows.length > 0) {
        const lparNames = installationsCheck.rows.map(r => r.lpar_name).join(', ');
        return fail(400, {
          message: `Cannot delete LPARs with installations: ${lparNames}. Remove installations first.`
        });
      }
      
      await db.query(
        'DELETE FROM lpars WHERE lpar_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} LPAR${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting LPARs:', error);
      return fail(500, {
        message: 'An error occurred while deleting LPARs'
      });
    }
  }
};
