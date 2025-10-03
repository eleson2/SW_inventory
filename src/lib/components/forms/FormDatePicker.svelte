<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  
  type Props = {
    form: any;
    name: string;
    label: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
  };
  
  let { 
    form, 
    name, 
    label, 
    placeholder = 'Select date', 
    description = '', 
    required = false 
  }: Props = $props();
  
  const { form: formStore, errors } = form;
  const field = $derived($formStore[name]);
  const error = $derived($errors[name]);
</script>

<div class="space-y-2">
  <Label for={name}>
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </Label>
  
  <Input
    id={name}
    {name}
    type="date"
    bind:value={$formStore[name]}
    {placeholder}
    {required}
    class:border-destructive={error}
  />
  
  {#if description}
    <p class="text-sm text-muted-foreground">{description}</p>
  {/if}
  
  {#if error}
    <p class="text-sm font-medium text-destructive">{error}</p>
  {/if}
</div>
