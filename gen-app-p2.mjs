import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✓ Created: ${filePath}`);
}

console.log('🚀 Generating Products Pages...\n');

writeFile('src/routes/products/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { productSchema } from '$lib/schemas/product';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(productSchema));
  
  const productsResult = await db.query(\`
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
  \`);
  
  const vendorsResult = await db.query(\`
    SELECT vendor_id, vendor_name, vendor_code
    FROM vendors
    ORDER BY vendor_name
  \`);
  
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
        \`INSERT INTO software_products (vendor_id, product_name, product_code, description)
         VALUES ($1, $2, $3, $4)\`,
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
        \`UPDATE software_products 
         SET vendor_id = $1,
             product_name = $2, 
             product_code = $3, 
             description = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $5\`,
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
        \`SELECT p.product_name, COUNT(sv.version_id) as version_count
         FROM software_products p
         LEFT JOIN software_versions sv ON p.product_id = sv.product_id
         WHERE p.product_id = ANY($1::int[])
         GROUP BY p.product_id, p.product_name
         HAVING COUNT(sv.version_id) > 0\`,
        [ids]
      );
      
      if (versionsCheck.rows.length > 0) {
        const productNames = versionsCheck.rows.map(r => r.product_name).join(', ');
        return fail(400, {
          message: \`Cannot delete products with versions: \${productNames}. Remove versions first.\`
        });
      }
      
      await db.query(
        'DELETE FROM software_products WHERE product_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: \`Successfully deleted \${ids.length} product\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting products:', error);
      return fail(500, {
        message: 'An error occurred while deleting products'
      });
    }
  }
};
`);

writeFile('src/routes/products/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormSelect from '$lib/components/forms/FormSelect.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Select from '$lib/components/ui/select';
  import { productSchema } from '$lib/schemas/product';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedProduct = $state<any>(null);
  let productsToDelete = $state<any[]>([]);
  let selectedVendorId = $state<number | null>(null);
  
  const columns = [
    {
      key: 'product_name',
      label: 'Product Name',
      render: (product: any) => (
        <div class="font-medium">{product.product_name}</div>
      )
    },
    {
      key: 'product_code',
      label: 'Product Code',
      render: (product: any) => 
        product.product_code 
          ? <Badge variant="secondary">{product.product_code}</Badge>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      render: (product: any) => (
        <div class="flex items-center gap-2">
          <span class="text-sm">{product.vendor_name}</span>
          {#if product.vendor_code}
            <Badge variant="outline" class="text-xs">{product.vendor_code}</Badge>
          {/if}
        </div>
      )
    },
    {
      key: 'version_count',
      label: 'Versions',
      class: 'text-right',
      render: (product: any) => 
        product.version_count > 0 
          ? <Badge variant="outline">{product.version_count}</Badge>
          : <span class="text-muted-foreground text-sm">0</span>
    }
  ];
  
  const vendorOptions = $derived(
    data.vendors.map(v => ({
      value: v.vendor_id.toString(),
      label: v.vendor_code ? \`\${v.vendor_name} (\${v.vendor_code})\` : v.vendor_name
    }))
  );
  
  const filteredProducts = $derived(
    selectedVendorId 
      ? data.products.filter(p => p.vendor_id === selectedVendorId)
      : data.products
  );
  
  function handleCreateClick() {
    selectedProduct = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(product: any) {
    selectedProduct = product;
    editDialogOpen = true;
  }
  
  function handleCloneClick(product: any) {
    selectedProduct = {
      ...product,
      product_id: undefined,
      product_name: \`\${product.product_name} (Copy)\`,
      product_code: product.product_code ? \`\${product.product_code}-COPY\` : undefined
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(products: any[]) {
    productsToDelete = products;
    deleteDialogOpen = true;
  }
  
  function handleVendorFilterChange(value: string) {
    selectedVendorId = value === 'all' ? null : parseInt(value);
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Products</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Products</h1>
      <p class="text-muted-foreground">
        Manage software products and their versions
      </p>
    </div>
    
    <EntityTable
      items={filteredProducts}
      {columns}
      idField="product_id"
      searchFields={['product_name', 'product_code', 'vendor_name']}
      searchPlaceholder="Search products..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Product"
    >
      {#snippet filterSlot()}
        <Select.Root onSelectedChange={(v) => handleVendorFilterChange(v?.value || 'all')}>
          <Select.Trigger class="w-[180px]">
            <Select.Value placeholder="All Vendors" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All Vendors</Select.Item>
            {#each data.vendors as vendor}
              <Select.Item value={vendor.vendor_id.toString()}>
                {vendor.vendor_name}
              </Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {/snippet}
    </EntityTable>
  </div>
</div>

<EntityDialog
  bind:open={createDialogOpen}
  onOpenChange={(open) => createDialogOpen = open}
  item={selectedProduct}
  data={data}
  schema={productSchema}
  entityName="Product"
  description="Add a new software product to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedProduct}
  cloneNotice={selectedProduct ? \`Cloning from: \${selectedProduct.product_name}\` : ''}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="product_id" value={form.form.data.product_id} />
    {/if}
    
    <FormSelect
      form={form.form}
      name="vendor_id"
      label="Vendor"
      options={vendorOptions}
      placeholder="Select a vendor..."
      required
    />
    
    <FormField
      form={form.form}
      name="product_name"
      label="Product Name"
      placeholder="e.g., WebSphere Application Server"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="product_code"
      label="Product Code"
      placeholder="e.g., WAS, DB2, MQ"
      description="Optional short code or SKU"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of the product..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedProduct}
  data={data}
  schema={productSchema}
  entityName="Product"
  description="Update product information"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="product_id" value={form.form.data.product_id} />
    {/if}
    
    <FormSelect
      form={form.form}
      name="vendor_id"
      label="Vendor"
      options={vendorOptions}
      placeholder="Select a vendor..."
      required
    />
    
    <FormField
      form={form.form}
      name="product_name"
      label="Product Name"
      placeholder="e.g., WebSphere Application Server"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="product_code"
      label="Product Code"
      placeholder="e.g., WAS, DB2, MQ"
      description="Optional short code or SKU"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of the product..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={productsToDelete}
  entityName="Product"
  idField="product_id"
  nameFormatter={(p) => p.product_name}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Products pages created!');
console.log('📝 Next: Run generate-lpars.mjs\n');
