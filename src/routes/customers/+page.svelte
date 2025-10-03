<script lang="ts">
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
          ? <a href={`mailto:${customer.contact_email}`} class="text-blue-600 hover:underline text-sm">{customer.contact_email}</a>
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
      customer_name: `${customer.customer_name} (Copy)`,
      customer_code: customer.customer_code ? `${customer.customer_code}-COPY` : undefined
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
  cloneNotice={selectedCustomer ? `Cloning from: ${selectedCustomer.customer_name}` : ''}
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
