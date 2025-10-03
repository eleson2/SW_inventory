<script lang="ts">
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
      label: p.product_code ? `${p.product_name} (${p.product_code})` : p.product_name,
      group: p.vendor_code ? `${p.vendor_name} (${p.vendor_code})` : p.vendor_name
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
      version_string: `${version.version_string}-COPY`
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
    const match = versionString.match(/^(d+)(?:.(d+))?(?:.(d+))?/);
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
  cloneNotice={selectedVersion ? `Cloning from: ${selectedVersion.product_name} ${selectedVersion.version_string}` : ''}
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
  nameFormatter={(v) => `${v.product_name} ${v.version_string}`}
  onSuccess={handleSuccess}
/>
