<script lang="ts">
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
      label: v.vendor_code ? `${v.vendor_name} (${v.vendor_code})` : v.vendor_name
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
      product_name: `${product.product_name} (Copy)`,
      product_code: product.product_code ? `${product.product_code}-COPY` : undefined
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
  cloneNotice={selectedProduct ? `Cloning from: ${selectedProduct.product_name}` : ''}
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
