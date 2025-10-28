<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Toast from '$lib/components/ui/Toast.svelte';
	import KeyboardShortcutsHelp from '$lib/components/common/KeyboardShortcutsHelp.svelte';
	import { useKeyboardShortcuts } from '$lib/utils/keyboard-shortcuts.svelte';

	let { children } = $props();

	// Keyboard shortcuts
	let showShortcutsHelp = $state(false);
	const shortcuts = useKeyboardShortcuts(() => {
		showShortcutsHelp = true;
	});

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	// Helper to check if current route matches nav item
	function isActive(path: string): boolean {
		return $page.url.pathname === path || $page.url.pathname.startsWith(`${path}/`);
	}

	// Close mobile menu when clicking a link
	function handleNavClick() {
		mobileMenuOpen = false;
	}
</script>

<svelte:window onkeydown={shortcuts.handleKeydown} />

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container flex h-14 items-center justify-between">
			<div class="flex items-center">
				<a href="/" class="mr-6 flex items-center space-x-2">
					<span class="font-bold text-lg">SW Inventory</span>
				</a>
				<!-- Desktop Navigation -->
				<nav class="hidden md:flex items-center space-x-6 text-sm font-medium">
					<a
						href="/customers"
						class="transition-colors hover:text-foreground/80 {isActive('/customers') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Customers
					</a>
					<a
						href="/vendors"
						class="transition-colors hover:text-foreground/80 {isActive('/vendors') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Vendors
					</a>
					<a
						href="/software"
						class="transition-colors hover:text-foreground/80 {isActive('/software') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Software
					</a>
					<a
						href="/packages"
						class="transition-colors hover:text-foreground/80 {isActive('/packages') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Packages
					</a>
					<a
						href="/lpars"
						class="transition-colors hover:text-foreground/80 {isActive('/lpars') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						LPARs
					</a>
					<a
						href="/import"
						class="transition-colors hover:text-foreground/80 {isActive('/import') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Import
					</a>
					<a
						href="/reports/software-by-customer"
						class="transition-colors hover:text-foreground/80 {isActive('/reports') ? 'text-foreground font-semibold border-b-2 border-primary' : 'text-foreground/60'}"
					>
						Reports
					</a>
				</nav>
			</div>

			<!-- Mobile Menu Button -->
			<button
				class="md:hidden p-2 hover:bg-accent rounded-md transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
				onclick={() => mobileMenuOpen = !mobileMenuOpen}
				aria-label="Toggle menu"
				aria-expanded={mobileMenuOpen}
			>
				{#if mobileMenuOpen}
					<!-- X icon -->
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				{:else}
					<!-- Hamburger icon -->
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				{/if}
			</button>
		</div>

		<!-- Mobile Navigation Menu -->
		{#if mobileMenuOpen}
			<div class="md:hidden border-t bg-background">
				<nav class="container py-4 flex flex-col space-y-3">
					<a
						href="/customers"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/customers') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Customers
					</a>
					<a
						href="/vendors"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/vendors') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Vendors
					</a>
					<a
						href="/software"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/software') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Software
					</a>
					<a
						href="/packages"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/packages') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Packages
					</a>
					<a
						href="/lpars"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/lpars') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						LPARs
					</a>
					<a
						href="/import"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/import') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Import
					</a>
					<a
						href="/reports/software-by-customer"
						onclick={handleNavClick}
						class="py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center {isActive('/reports') ? 'bg-accent text-foreground font-semibold' : 'text-foreground/60 hover:bg-accent/50'}"
					>
						Reports
					</a>
				</nav>
			</div>
		{/if}
	</header>
	<main class="flex-1">
		<div class="container py-6">
			{@render children()}
		</div>
	</main>
	<footer class="border-t py-4 md:py-0">
		<div class="container flex flex-col md:flex-row md:h-14 items-center justify-between text-sm text-muted-foreground gap-3 md:gap-0">
			<p class="text-center md:text-left">Software Inventory Management System</p>
			<div class="flex flex-col md:flex-row items-center gap-2 md:gap-4">
				<p class="text-center md:text-left">Multi-tenant Mainframe Environment</p>
				<button
					onclick={() => showShortcutsHelp = true}
					class="text-xs px-3 py-2 rounded border border-muted hover:bg-accent transition-colors flex items-center gap-1 min-h-[44px]"
					title="View keyboard shortcuts"
				>
					<kbd class="text-xs">?</kbd> Shortcuts
				</button>
			</div>
		</div>
	</footer>
</div>

<!-- Toast notifications -->
<Toast />

<!-- Keyboard shortcuts help dialog -->
<KeyboardShortcutsHelp bind:open={showShortcutsHelp} />
