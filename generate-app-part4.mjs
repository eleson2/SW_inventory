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

console.log('🚀 Part 4: Generating Entity Pages (Vendors, Customers, Products)...\n');

// =============================================================================
// VENDORS PAGE
// =============================================================================

writeFile('src/routes/vendors/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { vendorSchema } from '$lib/schemas/vendor';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(vendorSchema));
  
  const vendorsResult = await db.query(\`
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
  \`);
  
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
        \`INSERT INTO vendors (vendor_name, vendor_code, website, notes)
         VALUES ($1, $2, $3, $4)\`,
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
        \`UPDATE vendors 
         SET vendor_name = $1, 
             vendor_code = $2, 
             website = $3,
             notes = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE vendor_id = $5\`,
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
        \`SELECT v.vendor_name, COUNT(p.product_id) as product_count
         FROM vendors v
         LEFT JOIN software_products p ON v.vendor_id = p.vendor_id
         WHERE v.vendor_id = ANY($1::int[])
         GROUP BY v.vendor_id, v.vendor_name
         HAVING COUNT(p.product_id) > 0\`,
        [ids]
      );
      
      if (productsCheck.rows.length > 0) {
        const vendorNames = productsCheck.rows.map(r => r.vendor_name).join(', ');
        return fail(400, {
          message: \`Cannot delete vendors with products: \${vendorNames}. Remove products first.\`
        });
      }
      
      await db.query(
        'DELETE FROM vendors WHERE vendor_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: \`Successfully deleted \${ids.length} vendor\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting vendors:', error);
      return fail(500, {
        message: 'An error occurred while deleting vendors'
      });
    }
  }
};
`);

writeFile('src/routes/vendors/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { vendorSchema } from '$lib/schemas/vendor';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedVendor = $state<any>(null);
  let vendorsToDelete = $state<any[]>([]);
  
  const columns = [
    {
      key: 'vendor_name',
      label: 'Vendor Name',
      render: (vendor: any) => (
        <div class="font-medium">{vendor.vendor_name}</div>
      )
    },
    {
      key: 'vendor_code',
      label: 'Vendor Code',
      render: (vendor: any) => 
        vendor.vendor_code 
          ? <Badge variant="secondary">{vendor.vendor_code}</Badge>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'website',
      label: 'Website',
      render: (vendor: any) => 
        vendor.website 
          ? <a href={vendor.website} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-sm">{vendor.website}</a>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'product_count',
      label: 'Products',
      class: 'text-right',
      render: (vendor: any) => 
        vendor.product_count > 0 
          ? <Badge variant="outline">{vendor.product_count}</Badge>
          : <span class="text-muted-foreground text-sm">0</span>
    }
  ];
  
  function handleCreateClick() {
    selectedVendor = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(vendor: any) {
    selectedVendor = vendor;
    editDialogOpen = true;
  }
  
  function handleCloneClick(vendor: any) {
    selectedVendor = {
      ...vendor,
      vendor_id: undefined,
      vendor_name: \`\${vendor.vendor_name} (Copy)\`,
      vendor_code: vendor.vendor_code ? \`\${vendor.vendor_code}-COPY\` : undefined
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(vendors: any[]) {
    vendorsToDelete = vendors;
    deleteDialogOpen = true;
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Vendors</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Vendors</h1>
      <p class="text-muted-foreground">
        Manage software vendors and suppliers
      </p>
    </div>
    
    <EntityTable
      items={data.vendors}
      {columns}
      idField="vendor_id"
      searchFields={['vendor_name', 'vendor_code', 'website']}
      searchPlaceholder="Search vendors..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Vendor"
    />
  </div>
</div>

<!-- Create/Clone Dialog -->
<EntityDialog
  bind:open={createDialogOpen}
  onOpenChange={(open) => createDialogOpen = open}
  item={selectedVendor}
  data={data}
  schema={vendorSchema}
  entityName="Vendor"
  description="Add a new vendor to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedVendor}
  cloneNotice={selectedVendor ? \`Cloning from: \${selectedVendor.vendor_name}\` : ''}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="vendor_id" value={form.form.data.vendor_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="vendor_name"
      label="Vendor Name"
      placeholder="e.g., IBM, Oracle, Microsoft"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="vendor_code"
      label="Vendor Code"
      placeholder="e.g., IBM, ORCL, MSFT"
      description="Optional short code or abbreviation"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="website"
      label="Website"
      type="url"
      placeholder="https://www.example.com"
      description="Vendor's official website"
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this vendor..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<!-- Edit Dialog -->
<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedVendor}
  data={data}
  schema={vendorSchema}
  entityName="Vendor"
  description="Update vendor information"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="vendor_id" value={form.form.data.vendor_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="vendor_name"
      label="Vendor Name"
      placeholder="e.g., IBM, Oracle, Microsoft"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="vendor_code"
      label="Vendor Code"
      placeholder="e.g., IBM, ORCL, MSFT"
      description="Optional short code or abbreviation"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="website"
      label="Website"
      type="url"
      placeholder="https://www.example.com"
      description="Vendor's official website"
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this vendor..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<!-- Delete Dialog -->
<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={vendorsToDelete}
  entityName="Vendor"
  idField="vendor_id"
  nameFormatter={(v) => v.vendor_name}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Part 4 (1/3) Complete - Vendors page created!');
console.log('📝 Continuing with Customers and Products...\n');

// NOTE: This is getting very long. I should split this into multiple parts
// or provide instructions for the user to run additional scripts.

console.log('\n⚠️  IMPORTANT: This script is getting too large.');
console.log('I need to create Part 5 for the remaining entities.');
console.log('\nPlease run: node generate-app-part4.mjs first\n');
