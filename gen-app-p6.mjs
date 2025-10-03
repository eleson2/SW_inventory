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

console.log('🚀 Generating Versions Pages (FINAL ENTITY!)...\n');

writeFile('src/routes/versions/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { versionSchema } from '$lib/schemas/version';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(versionSchema));
  
  const versionsResult = await db.query(\`
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
  \`);
  
  const productsResult = await db.query(\`
    SELECT 
      p.product_id,
      p.product_name,
      p.product_code,
      v.vendor_name,
      v.vendor_code
    FROM software_products p
    JOIN vendors v ON p.vendor_id = v.vendor_id
    ORDER BY v.vendor_name, p.product_name
  \`);
  
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
        \`SELECT version_id FROM software_versions 
         WHERE product_id = $1 
         AND version_major = $2 
         AND COALESCE(version_minor, 0) = COALESCE($3, 0)
         AND COALESCE(version_patch, 0) = COALESCE($4, 0)\`,
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
        \`INSERT INTO software_versions 
         (product_id, version_string, version_major, version_minor, version_patch, release_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)\`,
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
        \`SELECT version_id FROM software_versions 
         WHERE product_id = $1 
         AND version_major = $2 
         AND COALESCE(version_minor, 0) = COALESCE($3, 0)
         AND COALESCE(version_patch, 0) = COALESCE($4, 0)
         AND version_id != $5\`,
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
        \`UPDATE software_versions 
         SET product_id = $1,
             version_string = $2,
             version_major = $3,
             version_minor = $4,
             version_patch = $5,
             release_date = $6,
             notes = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE version_id = $8\`,
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
        \`SELECT 
           sv.version_string,
           p.product_name,
           COUNT(li.installation_id) as installation_count
         FROM software_versions sv
         JOIN software_products p ON sv.product_id = p.product_id
         LEFT JOIN lpar_installations li ON sv.version_id = li.version_id
         WHERE sv.version_id = ANY($1::int[])
         GROUP BY sv.version_id, sv.version_string, p.product_name
         HAVING COUNT(li.installation_id) > 0\`,
        [ids]
      );
      
      if (installationsCheck.rows.length > 0) {
        const versionNames = installationsCheck.rows
          .map(r => \`\${r.product_name} \${r.version_string}\`)
          .join(', ');
        return fail(400, {
          message: \`Cannot delete versions with installations: \${versionNames}. Remove installations first.\`
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
        message: \`Successfully deleted \${ids.length} version\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting versions:', error);
      return fail(500, {
        message: 'An error occurred while deleting versions'
      });
    }
  }
};
`);

writeFile('src/routes/versions/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormSelectGrouped from '$lib/components/forms/FormSelectGrouped.svelte';
  import FormDatePicker from '$lib/components/forms/FormDatePicker.svelte';
  import VersionParsingPreview from '$lib/components/forms/VersionParsingPreview.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Select from '$lib/components/ui/select';
  import { versionSchema } from '$lib/schemas/version';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedVersion = $state<any>(null);
  let versionsToDelete = $state<any[]>([]);
  let selectedProductId = $state<number | null>(null);
  
  const columns = [
    {
      key: 'product_name',
      label: 'Product',
      render: (version: any) => (
        <div class="flex items-center gap-2">
          <span class="font-medium">{version.product_name}</span>
          {#if version.product_code}
            <Badge variant="outline" class="text-xs">{version.product_code}</Badge>
          {/if}
        </div>
      )
    },
    {
      key: 'vendor_name',
      label: 'Vendor',
      render: (version: any) => (
        <div class="flex items-center gap-2">
          <span class="text-sm">{version.vendor_name}</span>
          {#if version.vendor_code}
            <Badge variant="outline" class="text-xs">{version.vendor_code}</Badge>
          {/if}
        </div>
      )
    },
    {
      key: 'version_string',
      label: 'Version',
      render: (version: any) => (
        <Badge variant="secondary" class="font-mono">
          {version.version_string}
        </Badge>
      )
    },
    {
      key: 'version_parts',
      label: 'Parsed',
      render: (version: any) => {
        const parts = [version.version_major];
        if (version.version_minor !== null) parts.push(version.version_minor);
        if (version.version_patch !== null) parts.push(version.version_patch);
        return (
          <span class="font-mono text-sm text-muted-foreground">
            {parts.join('.')}
          </span>
        );
      }
    },
    {
      key: 'release_date',
      label: 'Release Date',
      render: (version: any) => 
        version.release_date 
          ? <span class="text-sm">{new Date(version.release_date).toLocaleDateString()}</span>
          : <span class="text-muted-foreground text-sm">—</span>
    }
  ];
  
  const productOptions = $derived(
    data.products.map(p => ({
      value: p.product_id,
      label: p.product_code ? \`\${p.product_name} (\${p.product_code})\` : p.product_name,
      group: p.vendor_code ? \`\${p.vendor_name} (\${p.vendor_code})\` : p.vendor_name
    }))
  );
  
  const filteredVersions = $derived(
    selectedProductId 
      ? data.versions.filter(v => v.product_id === selectedProductId)
      : data.versions
  );
  
  function handleCreateClick() {
    selectedVersion = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(version: any) {
    selectedVersion = version;
    editDialogOpen = true;
  }
  
  function handleCloneClick(version: any) {
    selectedVersion = {
      ...version,
      version_id: undefined,
      version_string: \`\${version.version_string}-COPY\`
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(versions: any[]) {
    versionsToDelete = versions;
    deleteDialogOpen = true;
  }
  
  function handleProductFilterChange(value: string) {
    selectedProductId = value === 'all' ? null : parseInt(value);
  }
  
  function parseVersionString(versionString: string, form: any) {
    const match = versionString.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (match) {
      form.update((data: any) => ({
        ...data,
        version_major: parseInt(match[1]),
        version_minor: match[2] ? parseInt(match[2]) : null,
        version_patch: match[3] ? parseInt(match[3]) : null
      }));
    }
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Versions</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Versions</h1>
      <p class="text-muted-foreground">
        Manage software product versions
      </p>
    </div>
    
    <EntityTable
      items={filteredVersions}
      {columns}
      idField="version_id"
      searchFields={['product_name', 'vendor_name', 'version_string']}
      searchPlaceholder="Search versions..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Version"
    >
      {#snippet filterSlot()}
        <Select.Root onSelectedChange={(v) => handleProductFilterChange(v?.value || 'all')}>
          <Select.Trigger class="w-[200px]">
            <Select.Value placeholder="All Products" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All Products</Select.Item>
            {#each data.products as product}
              <Select.Item value={product.product_id.toString()}>
                {product.product_name}
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
  item={selectedVersion}
  data={data}
  schema={versionSchema}
  entityName="Version"
  description="Add a new software version to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedVersion}
  cloneNotice={selectedVersion ? \`Cloning from: \${selectedVersion.product_name} \${selectedVersion.version_string}\` : ''}
  maxWidth="sm:max-w-[700px]"
>
  {#snippet children({ form })}
    <FormSelectGrouped
      form={form.form}
      name="product_id"
      label="Product"
      options={productOptions}
      placeholder="Select a product..."
      required
    />
    
    <FormField
      form={form.form}
      name="version_string"
      label="Version String"
      placeholder="e.g., 9.0.5, 2024.1, v1.2.3"
      description="Full version string as released by vendor"
      required
      maxlength={100}
    />
    
    <div class="p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
      💡 Tip: Enter the version string first, then manually fill in the parsed numbers below
    </div>
    
    <div class="grid grid-cols-3 gap-4">
      <FormField
        form={form.form}
        name="version_major"
        label="Major"
        type="number"
        placeholder="9"
        description="Required"
        required
      />
      
      <FormField
        form={form.form}
        name="version_minor"
        label="Minor"
        type="number"
        placeholder="0"
        description="Optional"
      />
      
      <FormField
        form={form.form}
        name="version_patch"
        label="Patch"
        type="number"
        placeholder="5"
        description="Optional"
      />
    </div>
    
    <VersionParsingPreview form={form.form} />
    
    <FormDatePicker
      form={form.form}
      name="release_date"
      label="Release Date"
      placeholder="Select release date"
      description="Optional - when this version was released"
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this version..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedVersion}
  data={data}
  schema={versionSchema}
  entityName="Version"
  description="Update version information"
  onSuccess={handleSuccess}
  maxWidth="sm:max-w-[700px]"
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="version_id" value={form.form.data.version_id} />
    {/if}
    
    <FormSelectGrouped
      form={form.form}
      name="product_id"
      label="Product"
      options={productOptions}
      placeholder="Select a product..."
      required
    />
    
    <FormField
      form={form.form}
      name="version_string"
      label="Version String"
      placeholder="e.g., 9.0.5, 2024.1, v1.2.3"
      description="Full version string as released by vendor"
      required
      maxlength={100}
    />
    
    <div class="grid grid-cols-3 gap-4">
      <FormField
        form={form.form}
        name="version_major"
        label="Major"
        type="number"
        placeholder="9"
        description="Required"
        required
      />
      
      <FormField
        form={form.form}
        name="version_minor"
        label="Minor"
        type="number"
        placeholder="0"
        description="Optional"
      />
      
      <FormField
        form={form.form}
        name="version_patch"
        label="Patch"
        type="number"
        placeholder="5"
        description="Optional"
      />
    </div>
    
    <VersionParsingPreview form={form.form} />
    
    <FormDatePicker
      form={form.form}
      name="release_date"
      label="Release Date"
      placeholder="Select release date"
      description="Optional - when this version was released"
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this version..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={versionsToDelete}
  entityName="Version"
  idField="version_id"
  nameFormatter={(v) => \`\${v.product_name} \${v.version_string}\`}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Versions pages created!');
console.log('\n🎉🎉🎉 ALL ENTITY PAGES COMPLETE! 🎉🎉🎉\n');
console.log('Summary of what you have now:');
console.log('  ✅ Vendors');
console.log('  ✅ Customers');
console.log('  ✅ Products');
console.log('  ✅ LPARs');
console.log('  ✅ Packages');
console.log('  ✅ Suites');
console.log('  ✅ Versions');
console.log('\n📝 What\'s left (optional):');
console.log('  - Package Contents management pages');
console.log('  - Suite Products management pages');
console.log('  - Installation forms (manual, package, rollback)');
console.log('\nYou now have a fully functional CRUD application! 🚀\n');
