<script lang="ts">
  import '../app.css';
  import AppNav from '$lib/components/navigation/AppNav.svelte';
  import { Toaster } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  
  let { children } = $props();
</script>

<ModeWatcher />
<Toaster richColors />

<AppNav>
  {@render children()}
</AppNav>
