import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { customerSchema } from '$lib/schemas/customer';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(customerSchema));
  
  const customersResult = await db.query(`
    SELECT 
      c.customer_id,
      c.customer_name,
      c.customer_code,
      c.contact_email,
      c.contact_phone,
      c.notes,
      c.created_at,
      COUNT(l.lpar_id) as lpar_count
    FROM customers c
    LEFT JOIN lpars l ON c.customer_id = l.customer_id
    GROUP BY c.customer_id, c.customer_name, c.customer_code, c.contact_email, 
             c.contact_phone, c.notes, c.created_at
    ORDER BY c.customer_name
  `);
  
  return {
    form,
    customers: customersResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(customerSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
      const existing = await db.query(
        'SELECT customer_id FROM customers WHERE LOWER(customer_name) = LOWER($1)',
        [form.data.customer_name]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A customer with this name already exists'
        });
      }
      
      await db.query(
        `INSERT INTO customers (customer_name, customer_code, contact_email, contact_phone, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          form.data.customer_name,
          form.data.customer_code || null,
          form.data.contact_email || null,
          form.data.contact_phone || null,
          form.data.notes || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Customer created successfully'
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the customer'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(customerSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.customer_id) {
      return fail(400, { form, message: 'Customer ID is required for update' });
    }
    
    try {
      const customerCheck = await db.query(
        'SELECT customer_id FROM customers WHERE customer_id = $1',
        [form.data.customer_id]
      );
      
      if (customerCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Customer not found'
        });
      }
      
      const existing = await db.query(
        'SELECT customer_id FROM customers WHERE LOWER(customer_name) = LOWER($1) AND customer_id != $2',
        [form.data.customer_name, form.data.customer_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A customer with this name already exists'
        });
      }
      
      await db.query(
        `UPDATE customers 
         SET customer_name = $1, 
             customer_code = $2, 
             contact_email = $3,
             contact_phone = $4,
             notes = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE customer_id = $6`,
        [
          form.data.customer_name,
          form.data.customer_code || null,
          form.data.contact_email || null,
          form.data.contact_phone || null,
          form.data.notes || null,
          form.data.customer_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Customer updated successfully'
      };
    } catch (error) {
      console.error('Error updating customer:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the customer'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const customerIds = formData.get('customer_ids');
    
    if (!customerIds) {
      return fail(400, { message: 'No customers selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(customerIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No customers selected for deletion' });
      }
      
      const lparsCheck = await db.query(
        `SELECT c.customer_name, COUNT(l.lpar_id) as lpar_count
         FROM customers c
         LEFT JOIN lpars l ON c.customer_id = l.customer_id
         WHERE c.customer_id = ANY($1::int[])
         GROUP BY c.customer_id, c.customer_name
         HAVING COUNT(l.lpar_id) > 0`,
        [ids]
      );
      
      if (lparsCheck.rows.length > 0) {
        const customerNames = lparsCheck.rows.map(r => r.customer_name).join(', ');
        return fail(400, {
          message: `Cannot delete customers with LPARs: ${customerNames}. Remove LPARs first.`
        });
      }
      
      await db.query(
        'DELETE FROM customers WHERE customer_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} customer${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting customers:', error);
      return fail(500, {
        message: 'An error occurred while deleting customers'
      });
    }
  }
};
