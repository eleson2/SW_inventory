<script lang="ts">
  type Props = {
    form: any;
  };
  
  let { form }: Props = $props();
  
  const { form: formStore } = form;
  const versionString = $derived($formStore.version_string || '');
  const major = $derived($formStore.version_major);
  const minor = $derived($formStore.version_minor);
  const patch = $derived($formStore.version_patch);
  
  const parsedPreview = $derived(() => {
    if (!versionString) return '';
    let parts = [];
    if (major !== null && major !== undefined) parts.push(major);
    if (minor !== null && minor !== undefined) parts.push(minor);
    if (patch !== null && patch !== undefined) parts.push(patch);
    return parts.length > 0 ? parts.join('.') : '';
  });
</script>

{#if versionString && parsedPreview()}
  <div class="p-3 bg-muted rounded-lg">
    <div class="text-sm">
      <span class="text-muted-foreground">Parsed as:</span>
      <span class="ml-2 font-mono font-medium">{parsedPreview()}</span>
    </div>
  </div>
{/if}
