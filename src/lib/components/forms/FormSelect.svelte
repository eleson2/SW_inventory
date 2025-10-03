<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  
  type Option = {
    value: string;
    label: string;
  };
  
  type Props = {
    form: any;
    name: string;
    label: string;
    options: Option[];
    placeholder?: string;
    description?: string;
    required?: boolean;
  };
  
  let { 
    form, 
    name, 
    label, 
    options, 
    placeholder = 'Select...', 
    description = '', 
    required = false 
  }: Props = $props();
  
  const { form: formStore, errors } = form;
  const field = $derived($formStore[name]);
  const error = $derived($errors[name]);
  
  const selectedOption = $derived(
    options.find(opt => opt.value === String(field))
  );
</script>

<div class="space-y-2">
  <Label for={name}>
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </Label>
  
  <Select.Root
    selected={selectedOption ? { value: selectedOption.value, label: selectedOption.label } : undefined}
    onSelectedChange={(v) => {
      if (v?.value) {
        formStore.update(d => ({ ...d, [name]: isNaN(Number(v.value)) ? v.value : Number(v.value) }));
      }
    }}
  >
    <Select.Trigger class={error ? 'border-destructive' : ''}>
      <Select.Value {placeholder} />
    </Select.Trigger>
    <Select.Content>
      {#each options as option}
        <Select.Item value={option.value}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
  
  <input type="hidden" {name} value={field || ''} />
  
  {#if description}
    <p class="text-sm text-muted-foreground">{description}</p>
  {/if}
  
  {#if error}
    <p class="text-sm font-medium text-destructive">{error}</p>
  {/if}
</div>
