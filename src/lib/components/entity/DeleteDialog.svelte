<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  
  type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: any[];
    entityName: string;
    entityNamePlural?: string;
    action?: string;
    idField?: string;
    nameFormatter?: (item: any) => string;
    warningMessage?: string;
    warningContent?: any;
    onSuccess?: () => void;
  };
  
  let { 
    open = $bindable(),
    onOpenChange,
    items,
    entityName,
    entityNamePlural,
    action = '?/delete',
    idField,
    nameFormatter,
    warningMessage,
    warningContent,
    onSuccess
  }: Props = $props();
  
  let isDeleting = $state(false);
  
  const plural = $derived(entityNamePlural || `${entityName}s`);
  const computedIdField = $derived(idField || `${entityName.toLowerCase()}_id`);
  const ids = $derived(items.map(item => item[computedIdField]));
  const names = $derived(
    items.map(item => 
      nameFormatter 
        ? nameFormatter(item) 
        : (item[`${entityName.toLowerCase()}_name`] || item.name || 'Unknown')
    ).join(', ')
  );
</script>

<AlertDialog.Root {open} onOpenChange={onOpenChange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        Delete {items.length} {items.length === 1 ? entityName : plural}?
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-2">
        {#if warningMessage}
          <p class="text-destructive font-medium">⚠️ {warningMessage}</p>
        {/if}
        
        {#if warningContent}
          {@render warningContent()}
        {/if}
        
        <p>
          Are you sure you want to delete the following {items.length === 1 ? entityName.toLowerCase() : plural.toLowerCase()}?
        </p>
        <p class="font-medium">{names}</p>
        <p class="text-sm text-muted-foreground">
          This action cannot be undone.
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
      <form 
        method="POST" 
        {action}
        use:enhance={() => {
          isDeleting = true;
          return async ({ result }) => {
            isDeleting = false;
            await applyAction(result);
            
            if (result.type === 'success') {
              toast.success(result.data?.message || `${plural} deleted successfully`);
              open = false;
              if (onSuccess) onSuccess();
              await invalidateAll();
            } else if (result.type === 'failure') {
              toast.error(result.data?.message || `Failed to delete ${plural.toLowerCase()}`);
            }
          };
        }}
      >
        <input type="hidden" name={`${computedIdField}s`} value={JSON.stringify(ids)} />
        <Button type="submit" variant="destructive" disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
