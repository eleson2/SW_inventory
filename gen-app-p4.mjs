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

console.log('🚀 Generating Packages Pages...\n');

writeFile('src/routes/packages/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { packageSchema } from '$lib/schemas/package';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(packageSchema));
  
  const packagesResult = await db.query(\`
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
  \`);
  
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
        \`INSERT INTO software_packages (package_name, package_version, build_date, description)
         VALUES ($1, $2, $3, $4)\`,
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
        \`UPDATE software_packages 
         SET package_name = $1, 
             package_version = $2, 
             build_date = $3,
             description = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE package_id = $5\`,
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
        message: \`Successfully deleted \${ids.length} package\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting packages:', error);
      return fail(500, {
        message: 'An error occurred while deleting packages'
      });
    }
  }
};
`);

writeFile('src/routes/packages/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormDatePicker from '$lib/components/forms/FormDatePicker.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Settings } from 'lucide-svelte';
  import { packageSchema } from '$lib/schemas/package';
  import { invalidateAll } from '$app/navigation';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedPackage = $state<any>(null);
  let packagesToDelete = $state<any[]>([]);
  
  const columns = [
    {
      key: 'package_name',
      label: 'Package Name',
      render: (pkg: any) => (
        <div class="font-medium">{pkg.package_name}</div>
      )
    },
    {
      key: 'package_version',
      label: 'Version',
      render: (pkg: any) => (
        <Badge variant="secondary">{pkg.package_version}</Badge>
      )
    },
    {
      key: 'build_date',
      label: 'Build Date',
      render: (pkg: any) => (
        <span class="text-sm">{new Date(pkg.build_date).toLocaleDateString()}</span>
      )
    },
    {
      key: 'content_count',
      label: 'Contents',
      class: 'text-right',
      render: (pkg: any) => 
        pkg.content_count > 0 
          ? <Badge variant="outline">{pkg.content_count}</Badge>
          : <Badge variant="destructive" class="text-xs">Empty</Badge>
    },
    {
      key: 'actions',
      label: '',
      class: 'text-center',
      render: (pkg: any) => (
        <Button
          variant="ghost"
          size="sm"
          onclick={(e) => handleManageContents(pkg.package_id, e)}
          title="Manage package contents"
        >
          <Settings class="h-4 w-4" />
        </Button>
      )
    }
  ];
  
  function handleCreateClick() {
    selectedPackage = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(pkg: any) {
    selectedPackage = pkg;
    editDialogOpen = true;
  }
  
  function handleCloneClick(pkg: any) {
    selectedPackage = {
      ...pkg,
      package_id: undefined,
      package_name: \`\${pkg.package_name} (Copy)\`,
      package_version: \`\${pkg.package_version}-COPY\`,
      build_date: new Date().toISOString().split('T')[0]
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(packages: any[]) {
    packagesToDelete = packages;
    deleteDialogOpen = true;
  }
  
  function handleManageContents(packageId: number, event: Event) {
    event.stopPropagation();
    goto(\`/packages/\${packageId}/contents\`);
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Packages</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Packages</h1>
      <p class="text-muted-foreground">
        Manage software deployment packages
      </p>
    </div>
    
    <EntityTable
      items={data.packages}
      {columns}
      idField="package_id"
      searchFields={['package_name', 'package_version', 'description']}
      searchPlaceholder="Search packages..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Package"
      showActions={false}
    />
  </div>
</div>

<EntityDialog
  bind:open={createDialogOpen}
  onOpenChange={(open) => createDialogOpen = open}
  item={selectedPackage}
  data={data}
  schema={packageSchema}
  entityName="Package"
  description="Add a new software package to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedPackage}
  cloneNotice={selectedPackage ? \`Cloning from: \${selectedPackage.package_name} \${selectedPackage.package_version}\` : ''}
>
  {#snippet children({ form })}
    <FormField
      form={form.form}
      name="package_name"
      label="Package Name"
      placeholder="e.g., Q2 2024 Production Update"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="package_version"
      label="Package Version"
      placeholder="e.g., 2024.Q2, v1.0"
      description="Version identifier for this package"
      required
      maxlength={50}
    />
    
    <FormDatePicker
      form={form.form}
      name="build_date"
      label="Build Date"
      placeholder="Select build date"
      description="When this package was created/built"
      required
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of what's in this package..."
      description="Optional description of the package contents or purpose"
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedPackage}
  data={data}
  schema={packageSchema}
  entityName="Package"
  description="Update package metadata (use Package Contents page to modify versions)"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="package_id" value={form.form.data.package_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="package_name"
      label="Package Name"
      placeholder="e.g., Q2 2024 Production Update"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="package_version"
      label="Package Version"
      placeholder="e.g., 2024.Q2, v1.0"
      description="Version identifier for this package"
      required
      maxlength={50}
    />
    
    <FormDatePicker
      form={form.form}
      name="build_date"
      label="Build Date"
      placeholder="Select build date"
      description="When this package was created/built"
      required
    />
    
    <FormField
      form={form.form}
      name="description"
      label="Description"
      type="textarea"
      placeholder="Brief description of what's in this package..."
      description="Optional description of the package contents or purpose"
      rows={3}
      maxlength={5000}
    />
    
    <div class="p-3 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
      💡 Tip: To modify package contents, use the "Manage Contents" button or Package Contents page.
    </div>
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={packagesToDelete}
  entityName="Package"
  idField="package_id"
  nameFormatter={(p) => \`\${p.package_name} \${p.package_version}\`}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Packages pages created!');
console.log('📝 Next: Run generate-suites.mjs\n');
