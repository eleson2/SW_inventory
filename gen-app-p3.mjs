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

console.log('🚀 Generating LPARs Pages...\n');

writeFile('src/routes/lpars/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { lparSchema } from '$lib/schemas/lpar';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(lparSchema));
  
  const lparsResult = await db.query(\`
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
  \`);
  
  const customersResult = await db.query(\`
    SELECT customer_id, customer_name, customer_code
    FROM customers
    ORDER BY customer_name
  \`);
  
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
        \`INSERT INTO lpars (customer_id, lpar_name, lpar_code, hostname, is_active, notes)
         VALUES ($1, $2, $3, $4, $5, $6)\`,
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
        \`UPDATE lpars 
         SET customer_id = $1,
             lpar_name = $2, 
             lpar_code = $3, 
             hostname = $4,
             is_active = $5,
             notes = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE lpar_id = $7\`,
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
        \`SELECT l.lpar_name, COUNT(li.installation_id) as installation_count
         FROM lpars l
         LEFT JOIN lpar_installations li ON l.lpar_id = li.lpar_id
         WHERE l.lpar_id = ANY($1::int[])
         GROUP BY l.lpar_id, l.lpar_name
         HAVING COUNT(li.installation_id) > 0\`,
        [ids]
      );
      
      if (installationsCheck.rows.length > 0) {
        const lparNames = installationsCheck.rows.map(r => r.lpar_name).join(', ');
        return fail(400, {
          message: \`Cannot delete LPARs with installations: \${lparNames}. Remove installations first.\`
        });
      }
      
      await db.query(
        'DELETE FROM lpars WHERE lpar_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: \`Successfully deleted \${ids.length} LPAR\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting LPARs:', error);
      return fail(500, {
        message: 'An error occurred while deleting LPARs'
      });
    }
  }
};
`);

writeFile('src/routes/lpars/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import FormSelect from '$lib/components/forms/FormSelect.svelte';
  import FormSwitch from '$lib/components/forms/FormSwitch.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import * as Select from '$lib/components/ui/select';
  import { CheckCircle, XCircle } from 'lucide-svelte';
  import { lparSchema } from '$lib/schemas/lpar';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedLpar = $state<any>(null);
  let lparsToDelete = $state<any[]>([]);
  let selectedCustomerId = $state<number | null>(null);
  
  const columns = [
    {
      key: 'lpar_name',
      label: 'LPAR Name',
      render: (lpar: any) => (
        <div class="font-medium">{lpar.lpar_name}</div>
      )
    },
    {
      key: 'lpar_code',
      label: 'LPAR Code',
      render: (lpar: any) => 
        lpar.lpar_code 
          ? <Badge variant="secondary">{lpar.lpar_code}</Badge>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (lpar: any) => (
        <div class="flex items-center gap-2">
          <span class="text-sm">{lpar.customer_name}</span>
          {#if lpar.customer_code}
            <Badge variant="outline" class="text-xs">{lpar.customer_code}</Badge>
          {/if}
        </div>
      )
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (lpar: any) => 
        lpar.is_active 
          ? (
            <Badge variant="default" class="text-xs">
              <CheckCircle class="h-3 w-3 mr-1" />
              Active
            </Badge>
          )
          : (
            <Badge variant="secondary" class="text-xs">
              <XCircle class="h-3 w-3 mr-1" />
              Inactive
            </Badge>
          )
    },
    {
      key: 'installation_count',
      label: 'Installations',
      class: 'text-right',
      render: (lpar: any) => 
        lpar.installation_count > 0 
          ? <Badge variant="outline">{lpar.installation_count}</Badge>
          : <span class="text-muted-foreground text-sm">0</span>
    }
  ];
  
  const customerOptions = $derived(
    data.customers.map(c => ({
      value: c.customer_id.toString(),
      label: c.customer_code ? \`\${c.customer_name} (\${c.customer_code})\` : c.customer_name
    }))
  );
  
  const filteredLpars = $derived(
    selectedCustomerId 
      ? data.lpars.filter(l => l.customer_id === selectedCustomerId)
      : data.lpars
  );
  
  function handleCreateClick() {
    selectedLpar = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(lpar: any) {
    selectedLpar = lpar;
    editDialogOpen = true;
  }
  
  function handleCloneClick(lpar: any) {
    selectedLpar = {
      ...lpar,
      lpar_id: undefined,
      lpar_name: \`\${lpar.lpar_name} (Copy)\`,
      lpar_code: lpar.lpar_code ? \`\${lpar.lpar_code}-COPY\` : undefined
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(lpars: any[]) {
    lparsToDelete = lpars;
    deleteDialogOpen = true;
  }
  
  function handleCustomerFilterChange(value: string) {
    selectedCustomerId = value === 'all' ? null : parseInt(value);
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>LPARs</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">LPARs</h1>
      <p class="text-muted-foreground">
        Manage logical partitions and their software installations
      </p>
    </div>
    
    <EntityTable
      items={filteredLpars}
      {columns}
      idField="lpar_id"
      searchFields={['lpar_name', 'lpar_code', 'customer_name', 'hostname']}
      searchPlaceholder="Search LPARs..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New LPAR"
    >
      {#snippet filterSlot()}
        <Select.Root onSelectedChange={(v) => handleCustomerFilterChange(v?.value || 'all')}>
          <Select.Trigger class="w-[180px]">
            <Select.Value placeholder="All Customers" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="all">All Customers</Select.Item>
            {#each data.customers as customer}
              <Select.Item value={customer.customer_id.toString()}>
                {customer.customer_name}
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
  item={selectedLpar}
  data={data}
  schema={lparSchema}
  entityName="LPAR"
  description="Add a new logical partition to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedLpar}
  cloneNotice={selectedLpar ? \`Cloning from: \${selectedLpar.lpar_name}\` : ''}
>
  {#snippet children({ form })}
    <FormSelect
      form={form.form}
      name="customer_id"
      label="Customer"
      options={customerOptions}
      placeholder="Select a customer..."
      required
    />
    
    <FormField
      form={form.form}
      name="lpar_name"
      label="LPAR Name"
      placeholder="e.g., PROD-LPAR-01"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="lpar_code"
      label="LPAR Code"
      placeholder="e.g., P01, DEV, TEST"
      description="Optional short identifier"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="hostname"
      label="Hostname"
      placeholder="e.g., server01.example.com"
      maxlength={255}
    />
    
    <FormSwitch
      form={form.form}
      name="is_active"
      label="Active"
      description="Whether this LPAR is currently in use"
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this LPAR..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedLpar}
  data={data}
  schema={lparSchema}
  entityName="LPAR"
  description="Update LPAR information"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="lpar_id" value={form.form.data.lpar_id} />
    {/if}
    
    <FormSelect
      form={form.form}
      name="customer_id"
      label="Customer"
      options={customerOptions}
      placeholder="Select a customer..."
      required
    />
    
    <FormField
      form={form.form}
      name="lpar_name"
      label="LPAR Name"
      placeholder="e.g., PROD-LPAR-01"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="lpar_code"
      label="LPAR Code"
      placeholder="e.g., P01, DEV, TEST"
      description="Optional short identifier"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="hostname"
      label="Hostname"
      placeholder="e.g., server01.example.com"
      maxlength={255}
    />
    
    <FormSwitch
      form={form.form}
      name="is_active"
      label="Active"
      description="Whether this LPAR is currently in use"
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this LPAR..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={lparsToDelete}
  entityName="LPAR"
  idField="lpar_id"
  nameFormatter={(l) => l.lpar_name}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ LPARs pages created!');
console.log('📝 Next: Run generate-packages.mjs\n');
