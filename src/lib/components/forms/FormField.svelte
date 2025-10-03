<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  
  type Props = {
    form: any;
    name: string;
    label: string;
    type?: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
    maxlength?: number;
    rows?: number;
  };
  
  let { 
    form, 
    name, 
    label, 
    type = 'text', 
    placeholder = '', 
    description = '', 
    required = false,
    maxlength,
    rows = 3
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
  
  {#if type === 'textarea'}
    <Textarea
      id={name}
      {name}
      bind:value={$formStore[name]}
      {placeholder}
      {rows}
      {maxlength}
      {required}
      class:border-destructive={error}
    />
  {:else}
    <Input
      id={name}
      {name}
      {type}
      bind:value={$formStore[name]}
      {placeholder}
      {maxlength}
      {required}
      class:border-destructive={error}
    />
  {/if}
  
  {#if description}
    <p class="text-sm text-muted-foreground">{description}</p>
  {/if}
  
  {#if error}
    <p class="text-sm font-medium text-destructive">{error}</p>
  {/if}
</div>
