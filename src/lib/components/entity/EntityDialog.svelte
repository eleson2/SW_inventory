<script lang="ts" generics="T extends Record<string, any>">
  import { superForm } from 'sveltekit-superforms/client';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import type { SuperValidated } from 'sveltekit-superforms';
  import type { ZodSchema } from 'zod';
  
  type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item?: T | null;
    data: { form: SuperValidated<T> };
    schema: ZodSchema;
    entityName: string;
    description?: string;
    action?: string;
    onSuccess?: () => void;
    isClone?: boolean;
    cloneNotice?: string;
    maxWidth?: string;
    children: any;
  };
  
  let { 
    open = $bindable(),
    onOpenChange,
    item = null,
    data,
    schema,
    entityName,
    description = '',
    action,
    onSuccess,
    isClone = false,
    cloneNotice = '',
    maxWidth = 'sm:max-w-[600px]',
    children
  }: Props = $props();
  
  const isEdit = $derived(!!item && !isClone);
  const computedAction = $derived(action || (isEdit ? '?/update' : '?/create'));
  const title = $derived(
    isClone ? `Clone ${entityName}` : (isEdit ? `Edit ${entityName}` : `Create New ${entityName}`)
  );
  
  const form = superForm(data.form, {
    validators: zodClient(schema),
    resetForm: true,
    onUpdated: ({ form }) => {
      if (form.valid && form.message) {
        if (form.message.includes('successfully')) {
          toast.success(form.message);
          open = false;
          if (onSuccess) onSuccess();
        } else {
          toast.error(form.message);
        }
      }
    }
  });
  
  const { enhance, delayed } = form;
  
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && !$delayed) {
      form.reset();
    }
    onOpenChange(newOpen);
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="{maxWidth} max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
      {#if isClone && cloneNotice}
        <div class="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
          ℹ️ {cloneNotice}
        </div>
      {/if}
    </Dialog.Header>
    
    <form method="POST" action={computedAction} use:enhance class="space-y-4">
      {@render children({ form, isEdit, item, delayed: $delayed })}
      
      <Dialog.Footer>
        <Button 
          type="button" 
          variant="outline" 
          onclick={() => open = false} 
          disabled={$delayed}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={$delayed}>
          {$delayed ? 'Saving...' : (isEdit ? `Update ${entityName}` : `Create ${entityName}`)}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
