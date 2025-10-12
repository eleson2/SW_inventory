<script lang="ts">
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';

	const modules = [
		{
			title: 'Customers',
			description: 'Manage customer information in multi-tenant environment',
			href: '/customers',
			icon: '👥'
		},
		{
			title: 'Vendors',
			description: 'Track software vendors and their contact information',
			href: '/vendors',
			icon: '🏢'
		},
		{
			title: 'Software',
			description: 'Manage software products with versions and PTF levels',
			href: '/software',
			icon: '💿'
		},
		{
			title: 'Packages',
			description: 'Create and manage software package releases',
			href: '/packages',
			icon: '📦'
		},
		{
			title: 'LPARs',
			description: 'Monitor LPAR configurations and installed software',
			href: '/lpars',
			icon: '🖥️'
		}
	];
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Software Inventory System</h1>
		<p class="text-muted-foreground mt-2">
			Manage mainframe software inventory across multiple tenants and LPARs
		</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each modules as module}
			<Card class="p-6 hover:shadow-md transition-shadow">
				<div class="flex flex-col space-y-4">
					<div class="flex items-center space-x-4">
						<div class="text-4xl">{module.icon}</div>
						<div class="flex-1">
							<h3 class="text-lg font-semibold">{module.title}</h3>
						</div>
					</div>
					<p class="text-sm text-muted-foreground">{module.description}</p>
					<Button variant="outline" onclick={() => window.location.href = module.href}>
						View {module.title}
					</Button>
				</div>
			</Card>
		{/each}
	</div>

	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">System Overview</h2>
		<div class="space-y-2 text-sm text-muted-foreground">
			<p>✓ Track software versions and PTF levels from vendor designations</p>
			<p>✓ Manage software packages for coordinated deployments</p>
			<p>✓ Monitor LPAR package levels and individual software installations</p>
			<p>✓ Support for individual product rollback capabilities</p>
			<p>✓ Multi-tenant customer environment support</p>
		</div>
	</Card>
</div>
