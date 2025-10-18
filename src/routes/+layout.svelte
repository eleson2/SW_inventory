<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container flex h-14 items-center">
			<div class="mr-4 flex">
				<a href="/" class="mr-6 flex items-center space-x-2">
					<span class="font-bold text-lg">SW Inventory</span>
				</a>
				<nav class="flex items-center space-x-6 text-sm font-medium">
					<a href="/customers" class="transition-colors hover:text-foreground/80">Customers</a>
					<a href="/vendors" class="transition-colors hover:text-foreground/80">Vendors</a>
					<a href="/software" class="transition-colors hover:text-foreground/80">Software</a>
					<a href="/packages" class="transition-colors hover:text-foreground/80">Packages</a>
					<a href="/lpars" class="transition-colors hover:text-foreground/80">LPARs</a>
				</nav>
			</div>
		</div>
	</header>
	<main class="flex-1">
		<div class="container py-6">
			{@render children()}
		</div>
	</main>
	<footer class="border-t py-6 md:py-0">
		<div class="container flex h-14 items-center justify-between text-sm text-muted-foreground">
			<p>Software Inventory Management System</p>
			<p>Multi-tenant Mainframe Environment</p>
		</div>
	</footer>
</div>

<!-- Toast notifications -->
<Toast />
