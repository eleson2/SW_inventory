import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { productSchema } from '$lib/schemas/product';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(productSchema));
  
  const productsResult = await db.query(`
    SELECT 
      p.product_id,
      p.product_name,
      p.product_code,
      p.description,
      p.vendor_id,
      v.vendor_name,
      v.vendor_code,
      p.created_at,
      COUNT(sv.version_id) as version_count
    FROM software_products p
    JOIN vendors v ON p.vendor_id = v.vendor_id
    LEFT JOIN software_versions sv ON p.product_id = sv.product_id
    GROUP BY p.product_id, p.product_name, p.product_code, p.description,
             p.vendor_id, v.vendor_name, v.vendor_code, p.created_at
    ORDER BY v.vendor_name, p.product_name
  `);
  
  const vendorsResult = await db.query(`
    SELECT vendor_id, vendor_name, vendor_code
    FROM vendors
    ORDER BY vendor_name
  `);
  
  return {
    form,
    products: productsResult.rows,
    vendors: vendorsResult.rows
  };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await superValidate(request, zod(productSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    try {
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
      
      const existing = await db.query(
        'SELECT product_id FROM software_products WHERE LOWER(product_name) = LOWER($1) AND vendor_id = $2',
        [form.data.product_name, form.data.vendor_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A product with this name already exists for this vendor'
        });
      }
      
      await db.query(
        `INSERT INTO software_products (vendor_id, product_name, product_code, description)
         VALUES ($1, $2, $3, $4)`,
        [
          form.data.vendor_id,
          form.data.product_name,
          form.data.product_code || null,
          form.data.description || null
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Product created successfully'
      };
    } catch (error) {
      console.error('Error creating product:', error);
      return fail(500, {
        form,
        message: 'An error occurred while creating the product'
      });
    }
  },
  
  update: async ({ request }) => {
    const form = await superValidate(request, zod(productSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }
    
    if (!form.data.product_id) {
      return fail(400, { form, message: 'Product ID is required for update' });
    }
    
    try {
      const productCheck = await db.query(
        'SELECT product_id FROM software_products WHERE product_id = $1',
        [form.data.product_id]
      );
      
      if (productCheck.rows.length === 0) {
        return fail(404, {
          form,
          message: 'Product not found'
        });
      }
      
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
      
      const existing = await db.query(
        'SELECT product_id FROM software_products WHERE LOWER(product_name) = LOWER($1) AND vendor_id = $2 AND product_id != $3',
        [form.data.product_name, form.data.vendor_id, form.data.product_id]
      );
      
      if (existing.rows.length > 0) {
        return fail(409, {
          form,
          message: 'A product with this name already exists for this vendor'
        });
      }
      
      await db.query(
        `UPDATE software_products 
         SET vendor_id = $1,
             product_name = $2, 
             product_code = $3, 
             description = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $5`,
        [
          form.data.vendor_id,
          form.data.product_name,
          form.data.product_code || null,
          form.data.description || null,
          form.data.product_id
        ]
      );
      
      return {
        form,
        success: true,
        message: 'Product updated successfully'
      };
    } catch (error) {
      console.error('Error updating product:', error);
      return fail(500, {
        form,
        message: 'An error occurred while updating the product'
      });
    }
  },
  
  delete: async ({ request }) => {
    const formData = await request.formData();
    const productIds = formData.get('product_ids');
    
    if (!productIds) {
      return fail(400, { message: 'No products selected for deletion' });
    }
    
    try {
      const ids = JSON.parse(productIds as string) as number[];
      
      if (ids.length === 0) {
        return fail(400, { message: 'No products selected for deletion' });
      }
      
      const versionsCheck = await db.query(
        `SELECT p.product_name, COUNT(sv.version_id) as version_count
         FROM software_products p
         LEFT JOIN software_versions sv ON p.product_id = sv.product_id
         WHERE p.product_id = ANY($1::int[])
         GROUP BY p.product_id, p.product_name
         HAVING COUNT(sv.version_id) > 0`,
        [ids]
      );
      
      if (versionsCheck.rows.length > 0) {
        const productNames = versionsCheck.rows.map(r => r.product_name).join(', ');
        return fail(400, {
          message: `Cannot delete products with versions: ${productNames}. Remove versions first.`
        });
      }
      
      await db.query(
        'DELETE FROM software_products WHERE product_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: `Successfully deleted ${ids.length} product${ids.length !== 1 ? 's' : ''}`
      };
    } catch (error) {
      console.error('Error deleting products:', error);
      return fail(500, {
        message: 'An error occurred while deleting products'
      });
    }
  }
};
