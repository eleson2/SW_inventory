<script lang="ts">
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
      vendor_name: `${vendor.vendor_name} (Copy)`,
      vendor_code: vendor.vendor_code ? `${vendor.vendor_code}-COPY` : undefined
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
  cloneNotice={selectedVendor ? `Cloning from: ${selectedVendor.vendor_name}` : ''}
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
