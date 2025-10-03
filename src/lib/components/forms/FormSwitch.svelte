<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  
  type Props = {
    form: any;
    name: string;
    label: string;
    description?: string;
  };
  
  let { form, name, label, description }: Props = $props();
  
  const { form: formStore, errors } = form;
  const field = $derived($formStore[name]);
  const error = $derived($errors[name]);
</script>

<div class="flex items-center justify-between space-x-2">
  <div class="space-y-0.5 flex-1">
    <Label for={name}>{label}</Label>
    {#if description}
      <p class="text-sm text-muted-foreground">{description}</p>
    {/if}
  </div>
  <Switch
    id={name}
    {name}
    checked={field}
    onCheckedChange={(checked) => formStore.update(d => ({ ...d, [name]: checked }))}
  />
</div>

{#if error}
  <p class="text-sm font-medium text-destructive">{error}</p>
{/if}
