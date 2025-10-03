<script lang="ts">
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
      package_name: `${pkg.package_name} (Copy)`,
      package_version: `${pkg.package_version}-COPY`,
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
    goto(`/packages/${packageId}/contents`);
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
  cloneNotice={selectedPackage ? `Cloning from: ${selectedPackage.package_name} ${selectedPackage.package_version}` : ''}
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
  nameFormatter={(p) => `${p.package_name} ${p.package_version}`}
  onSuccess={handleSuccess}
/>
