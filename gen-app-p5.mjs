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

console.log('🚀 Generating Suites Pages...\n');

writeFile('src/routes/suites/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { suiteSchema } from '$lib/schemas/suite';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(suiteSchema));
  
  const suitesResult = await db.query(\`
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
  \`);
  
  const vendorsResult = await db.query(\`
    SELECT vendor_id, vendor_name, vendor_code
    FROM vendors
    ORDER BY vendor_name
  \`);
  
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
        \`INSERT INTO software_suites (suite_name, suite_version, description, vendor_id)
         VALUES ($1, $2, $3, $4)\`,
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
        \`UPDATE software_suites 
         SET suite_name = $1, 
             suite_version = $2, 
             description = $3,
             vendor_id = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE suite_id = $5\`,
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
        message: \`Successfully deleted \${ids.length} suite\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting suites:', error);
      return fail(500, {
        message: 'An error occurred while deleting suites'
      });
    }
  }
};
`);

writeFile('src/routes/suites/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormSelect from '$lib/components/forms/FormSelect.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import { Settings } from 'lucide-svelte';
  import { suiteSchema } from '$lib/schemas/suite';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedSuite = $state<any>(null);
  let suitesToDelete = $state<any[]>([]);
  let selectedVendorId = $state<number | null>(null);
  
  const columns = [
    {
      key: 'suite_name',
      label: 'Suite Name',
      render: (suite: any) => (
        <div class="font-medium">{suite.suite_name}</div>
      )
    },
    {
      key: 'suite_version',
      label: 'Version',
      render: (suite: any) => (
        <Badge variant="secondary">{suite.suite_version}</Badge>
      )
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      render: (suite: any) => 
        suite.vendor_name 
          ? (
            <div class="flex items-center gap-2">
              <span class="text-sm">{suite.vendor_name}</span>
              {#if suite.vendor_code}
                <Badge variant="outline" class="text-xs">{suite.vendor_code}</Badge>
              {/if}
            </div>
          )
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'product_count',
      label: 'Products',
      class: 'text-right',
      render: (suite: any) => 
        suite.product_count > 0 
          ? <Badge variant="outline">{suite.product_count}</Badge>
          : <Badge variant="destructive" class="text-xs">Empty</Badge>
    },
    {
      key: 'actions',
      label: '',
      class: 'text-center',
      render: (suite: any) => (
        <Button
          variant="ghost"
          size="sm"
          onclick={(e) => handleManageProducts(suite.suite_id, e)}
          title="Manage suite products"
        >
          <Settings class="h-4 w-4" />
        </Button>
      )
    }
  ];
  
  const vendorOptions = $derived([
    { value: '', label: 'No vendor (generic suite)' },
    ...data.vendors.map(v => ({
      value: v.vendor_id.toString(),
      label: v.vendor_code ? \`\${v.vendor_name} (\${v.vendor_code})\` : v.vendor_name
    }))
  ]);
  
  const filteredSuites = $derived(
    selectedVendorId 
      ? data.suites.filter(s => s.vendor_id === selectedVendorId)
      : data.suites
  );
  
  function handleCreateClick() {
    selectedSuite = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(suite: any) {
    selectedSuite = suite;
    editDialogOpen = true;
  }
  
  function handleCloneClick(suite: any) {
    selectedSuite = {
      ...suite,
      suite_id: undefined,
      suite_name: \`\${suite.suite_name} (Copy)\`,
      suite_version: \`\${suite.suite_version}-COPY\`
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(suites: any[]) {
    suitesToDelete = suites;
    deleteDialogOpen = true;
  }
  
  function handleManageProducts(suiteId: number, event: Event) {
    event.stopPropagation();
    goto(\`/suites/\${suiteId}/products\`);
  }
  
  function handleVendorFilterChange(value: string) {
    selectedVendorId = value === 'all' ? null : parseInt(value);
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Suites</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Suites</h1>
      <p class="text-muted-foreground">
        Manage software suites and product bundles
      </p>
    </div>
    
    <EntityTable
      items={filteredSuites}
      {columns}
      idField="suite_id"
      searchFields={['suite_name', 'suite_version', 'vendor_name', 'description']}
      searchPlaceholder="Search suites..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Suite"
      showActions={false}
    >
      {#snippet filterSlot()}
        <Select.Root onSelectedChange={(v) => handleVendorFilterChange(v?.value || 'all')}>
          <Select.Trigger class="w-[180px]">
            <Select.Value placeholder="All Vendors" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All Vendors</Select.Item>
            <Select.Item value="null">No Vendor</Select.Item>
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
  item={selectedSuite}
  data={data}
  schema={suiteSchema}
  entityName="Suite"
  description="Add a new software suite to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedSuite}
  cloneNotice={selectedSuite ? \`Cloning from: \${selectedSuite.suite_name} \${selectedSuite.suite_version}\` : ''}
>
  {#snippet children({ form })}
    <FormField
      form={form.form}
      name="suite_name"
      label="Suite Name"
      placeholder="e.g., IBM WebSphere Suite, Microsoft Office"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="suite_version"
      label="Suite Version"
      placeholder="e.g., 9.0, 2024, Enterprise"
      description="Version identifier for this suite"
      required
      maxlength={50}
    />
    
    <FormSelect
      form={form.form}
      name="vendor_id"
      label="Vendor (Optional)"
      options={vendorOptions}
      placeholder="Select a vendor..."
      description="Leave empty for generic/multi-vendor suites"
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of what's in this suite..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedSuite}
  data={data}
  schema={suiteSchema}
  entityName="Suite"
  description="Update suite metadata (use Suite Products page to modify products)"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="suite_id" value={form.form.data.suite_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="suite_name"
      label="Suite Name"
      placeholder="e.g., IBM WebSphere Suite, Microsoft Office"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="suite_version"
      label="Suite Version"
      placeholder="e.g., 9.0, 2024, Enterprise"
      description="Version identifier for this suite"
      required
      maxlength={50}
    />
    
    <FormSelect
      form={form.form}
      name="vendor_id"
      label="Vendor (Optional)"
      options={vendorOptions}
      placeholder="Select a vendor..."
      description="Leave empty for generic/multi-vendor suites"
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of what's in this suite..."
      rows={3}
      maxlength={5000}
    />
    
    <div class="p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
      💡 Tip: To modify suite products, use the "Manage Products" button or Suite Products page.
    </div>
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={suitesToDelete}
  entityName="Suite"
  idField="suite_id"
  nameFormatter={(s) => \`\${s.suite_name} \${s.suite_version}\`}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Suites pages created!');
console.log('📝 Next: Run generate-versions.mjs (last one!)\n');
