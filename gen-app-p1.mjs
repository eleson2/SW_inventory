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

console.log('🚀 Generating Customers Pages...\n');

writeFile('src/routes/customers/+page.server.ts', `import { fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { customerSchema } from '$lib/schemas/customer';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(customerSchema));
  
  const customersResult = await db.query(\`
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
  \`);
  
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
        \`INSERT INTO customers (customer_name, customer_code, contact_email, contact_phone, notes)
         VALUES ($1, $2, $3, $4, $5)\`,
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
        \`UPDATE customers 
         SET customer_name = $1, 
             customer_code = $2, 
             contact_email = $3,
             contact_phone = $4,
             notes = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE customer_id = $6\`,
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
        \`SELECT c.customer_name, COUNT(l.lpar_id) as lpar_count
         FROM customers c
         LEFT JOIN lpars l ON c.customer_id = l.customer_id
         WHERE c.customer_id = ANY($1::int[])
         GROUP BY c.customer_id, c.customer_name
         HAVING COUNT(l.lpar_id) > 0\`,
        [ids]
      );
      
      if (lparsCheck.rows.length > 0) {
        const customerNames = lparsCheck.rows.map(r => r.customer_name).join(', ');
        return fail(400, {
          message: \`Cannot delete customers with LPARs: \${customerNames}. Remove LPARs first.\`
        });
      }
      
      await db.query(
        'DELETE FROM customers WHERE customer_id = ANY($1::int[])',
        [ids]
      );
      
      return {
        success: true,
        message: \`Successfully deleted \${ids.length} customer\${ids.length !== 1 ? 's' : ''}\`
      };
    } catch (error) {
      console.error('Error deleting customers:', error);
      return fail(500, {
        message: 'An error occurred while deleting customers'
      });
    }
  }
};
`);

writeFile('src/routes/customers/+page.svelte', `<script lang="ts">
  import EntityTable from '$lib/components/entity/EntityTable.svelte';
  import EntityDialog from '$lib/components/entity/EntityDialog.svelte';
  import DeleteDialog from '$lib/components/entity/DeleteDialog.svelte';
  import FormField from '$lib/components/forms/FormField.svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { customerSchema } from '$lib/schemas/customer';
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  let createDialogOpen = $state(false);
  let editDialogOpen = $state(false);
  let deleteDialogOpen = $state(false);
  let selectedCustomer = $state<any>(null);
  let customersToDelete = $state<any[]>([]);
  
  const columns = [
    {
      key: 'customer_name',
      label: 'Customer Name',
      render: (customer: any) => (
        <div class="font-medium">{customer.customer_name}</div>
      )
    },
    {
      key: 'customer_code',
      label: 'Customer Code',
      render: (customer: any) => 
        customer.customer_code 
          ? <Badge variant="secondary">{customer.customer_code}</Badge>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'contact_email',
      label: 'Contact Email',
      render: (customer: any) => 
        customer.contact_email 
          ? <a href={\`mailto:\${customer.contact_email}\`} class="text-blue-600 hover:underline text-sm">{customer.contact_email}</a>
          : <span class="text-muted-foreground text-sm">—</span>
    },
    {
      key: 'lpar_count',
      label: 'LPARs',
      class: 'text-right',
      render: (customer: any) => 
        customer.lpar_count > 0 
          ? <Badge variant="outline">{customer.lpar_count}</Badge>
          : <span class="text-muted-foreground text-sm">0</span>
    }
  ];
  
  function handleCreateClick() {
    selectedCustomer = null;
    createDialogOpen = true;
  }
  
  function handleEditClick(customer: any) {
    selectedCustomer = customer;
    editDialogOpen = true;
  }
  
  function handleCloneClick(customer: any) {
    selectedCustomer = {
      ...customer,
      customer_id: undefined,
      customer_name: \`\${customer.customer_name} (Copy)\`,
      customer_code: customer.customer_code ? \`\${customer.customer_code}-COPY\` : undefined
    };
    createDialogOpen = true;
  }
  
  function handleDeleteClick(customers: any[]) {
    customersToDelete = customers;
    deleteDialogOpen = true;
  }
  
  async function handleSuccess() {
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Customers</title>
</svelte:head>

<div class="container mx-auto py-8 px-4">
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Customers</h1>
      <p class="text-muted-foreground">
        Manage customer accounts and contacts
      </p>
    </div>
    
    <EntityTable
      items={data.customers}
      {columns}
      idField="customer_id"
      searchFields={['customer_name', 'customer_code', 'contact_email']}
      searchPlaceholder="Search customers..."
      onCreateClick={handleCreateClick}
      onEditClick={handleEditClick}
      onCloneClick={handleCloneClick}
      onDeleteClick={handleDeleteClick}
      createLabel="New Customer"
    />
  </div>
</div>

<EntityDialog
  bind:open={createDialogOpen}
  onOpenChange={(open) => createDialogOpen = open}
  item={selectedCustomer}
  data={data}
  schema={customerSchema}
  entityName="Customer"
  description="Add a new customer to the system"
  onSuccess={handleSuccess}
  isClone={!!selectedCustomer}
  cloneNotice={selectedCustomer ? \`Cloning from: \${selectedCustomer.customer_name}\` : ''}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="customer_id" value={form.form.data.customer_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="customer_name"
      label="Customer Name"
      placeholder="e.g., Acme Corporation"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="customer_code"
      label="Customer Code"
      placeholder="e.g., ACME, CORP01"
      description="Optional short code or identifier"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="contact_email"
      label="Contact Email"
      type="email"
      placeholder="contact@example.com"
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="contact_phone"
      label="Contact Phone"
      type="tel"
      placeholder="+1 (555) 123-4567"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this customer..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<EntityDialog
  bind:open={editDialogOpen}
  onOpenChange={(open) => editDialogOpen = open}
  item={selectedCustomer}
  data={data}
  schema={customerSchema}
  entityName="Customer"
  description="Update customer information"
  onSuccess={handleSuccess}
>
  {#snippet children({ form, isEdit })}
    {#if isEdit}
      <input type="hidden" name="customer_id" value={form.form.data.customer_id} />
    {/if}
    
    <FormField
      form={form.form}
      name="customer_name"
      label="Customer Name"
      placeholder="e.g., Acme Corporation"
      required
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="customer_code"
      label="Customer Code"
      placeholder="e.g., ACME, CORP01"
      description="Optional short code or identifier"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="contact_email"
      label="Contact Email"
      type="email"
      placeholder="contact@example.com"
      maxlength={255}
    />
    
    <FormField
      form={form.form}
      name="contact_phone"
      label="Contact Phone"
      type="tel"
      placeholder="+1 (555) 123-4567"
      maxlength={50}
    />
    
    <FormField
      form={form.form}
      name="notes"
      label="Notes"
      type="textarea"
      placeholder="Any additional notes about this customer..."
      rows={3}
      maxlength={5000}
    />
  {/snippet}
</EntityDialog>

<DeleteDialog
  bind:open={deleteDialogOpen}
  onOpenChange={(open) => deleteDialogOpen = open}
  items={customersToDelete}
  entityName="Customer"
  idField="customer_id"
  nameFormatter={(c) => c.customer_name}
  onSuccess={handleSuccess}
/>
`);

console.log('\n✅ Customers pages created!');
console.log('📝 Next: Run generate-products.mjs\n');
