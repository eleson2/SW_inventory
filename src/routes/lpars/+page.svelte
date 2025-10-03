<script lang="ts">
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
      label: c.customer_code ? `${c.customer_name} (${c.customer_code})` : c.customer_name
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
      lpar_name: `${lpar.lpar_name} (Copy)`,
      lpar_code: lpar.lpar_code ? `${lpar.lpar_code}-COPY` : undefined
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
  cloneNotice={selectedLpar ? `Cloning from: ${selectedLpar.lpar_name}` : ''}
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
