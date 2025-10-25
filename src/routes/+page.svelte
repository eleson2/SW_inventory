<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import TermTooltip from '$components/common/TermTooltip.svelte';
	import { formatDateTime, formatDate } from '$utils/date-format';

	let { data }: { data: PageData } = $props();

	const modules = $derived([
		{
			title: 'Customers',
			description: 'Manage customer information in multi-tenant environment',
			href: '/customers',
			icon: '👥',
			count: data.stats.customers
		},
		{
			title: 'Vendors',
			description: 'Track software vendors and their contact information',
			href: '/vendors',
			icon: '🏢',
			count: data.stats.vendors
		},
		{
			title: 'Software',
			description: 'Manage software products with versions and PTF levels',
			href: '/software',
			icon: '💿',
			count: data.stats.software
		},
		{
			title: 'Packages',
			description: 'Create and manage software package releases',
			descriptionWithTooltip: true,
			href: '/packages',
			icon: '📦',
			count: data.stats.packages
		},
		{
			title: 'LPARs',
			description: 'Monitor LPAR configurations and installed software',
			descriptionWithTooltip: true,
			href: '/lpars',
			icon: '🖥️',
			count: data.stats.lpars
		}
	]);

	const hasAlerts = $derived(
		data.alerts.outOfCompliance.length > 0 || data.alerts.endOfSupport.length > 0
	);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Software Inventory System</h1>
		<p class="text-muted-foreground mt-2">
			Manage mainframe software inventory across multiple tenants and LPARs
		</p>
	</div>

	<!-- Alerts Section -->
	{#if hasAlerts}
		<Card class="p-6 border-amber-200 bg-amber-50/50">
			<div class="flex items-start gap-3">
				<svg class="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
				</svg>
				<div class="flex-1">
					<h2 class="text-lg font-semibold text-amber-800 mb-3">Attention Required</h2>
					<div class="space-y-3">
						{#if data.alerts.outOfCompliance.length > 0}
							<div>
								<h3 class="text-sm font-medium text-amber-800 mb-2">
									{data.alerts.outOfCompliance.length} LPAR{data.alerts.outOfCompliance.length !== 1 ? 's' : ''} Out of Compliance
								</h3>
								<ul class="space-y-1">
									{#each data.alerts.outOfCompliance as lpar}
										<li class="text-sm text-amber-700">
											<a href="/lpars/{lpar.lpar_id}" class="hover:underline font-medium">
												{lpar.lpar_name} ({lpar.lpar_code})
											</a>
											<span class="text-amber-600"> - {lpar.mismatch_count} version mismatch{lpar.mismatch_count !== 1 ? 'es' : ''}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if data.alerts.endOfSupport.length > 0}
							<div>
								<h3 class="text-sm font-medium text-amber-800 mb-2">
									{data.alerts.endOfSupport.length} Software Version{data.alerts.endOfSupport.length !== 1 ? 's' : ''} Nearing End of Support
								</h3>
								<ul class="space-y-1">
									{#each data.alerts.endOfSupport as version}
										<li class="text-sm text-amber-700">
											<a href="/software/{version.software.id}" class="hover:underline font-medium">
												{version.software.name} {version.version}
											</a>
											<span class="text-amber-600"> - ends {formatDate(version.end_of_support)}</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</Card>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each modules as module}
			<Card class="p-6 hover:shadow-md transition-shadow">
				<div class="flex flex-col space-y-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-4">
							<div class="text-4xl">{module.icon}</div>
							<div class="flex-1">
								<h3 class="text-lg font-semibold">{module.title}</h3>
							</div>
						</div>
						<Badge variant="secondary" class="text-lg px-3 py-1">{module.count}</Badge>
					</div>
					<p class="text-sm text-muted-foreground">
						{#if module.title === 'Packages'}
							Create and manage software <TermTooltip term="package">package</TermTooltip> releases
						{:else if module.title === 'LPARs'}
							Monitor <TermTooltip term="lpar">LPAR</TermTooltip> configurations and installed software
						{:else if module.title === 'Vendors'}
							Track software <TermTooltip term="vendor">vendors</TermTooltip> and their contact information
						{:else}
							{module.description}
						{/if}
					</p>
					<Button variant="outline" onclick={() => window.location.href = module.href}>
						View {module.title}
					</Button>
				</div>
			</Card>
		{/each}
	</div>

	<!-- Recent Activity Section -->
	<div class="grid gap-4 md:grid-cols-2">
		<!-- Recent Rollbacks -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Recent Rollbacks</h2>
			{#if data.recentActivity.rollbacks.length === 0}
				<p class="text-sm text-muted-foreground">No recent rollbacks</p>
			{:else}
				<ul class="space-y-3">
					{#each data.recentActivity.rollbacks as rollback}
						<li class="pb-3 border-b last:border-0">
							<div class="flex justify-between items-start">
								<div class="flex-1">
									<a href="/lpars/{rollback.lpars.id}" class="text-sm font-medium hover:underline">
										{rollback.lpars.name}
									</a>
									<p class="text-xs text-muted-foreground mt-1">
										{rollback.software.name} → v{rollback.previous_version || 'Unknown'}
										{#if rollback.previous_ptf_level}
											({rollback.previous_ptf_level})
										{/if}
									</p>
									{#if rollback.rollback_reason}
										<p class="text-xs text-muted-foreground mt-1 italic">
											Reason: {rollback.rollback_reason}
										</p>
									{/if}
								</div>
								<span class="text-xs text-muted-foreground whitespace-nowrap">
									{rollback.rolled_back_at ? formatDateTime(rollback.rolled_back_at) : 'Unknown'}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		<!-- System Overview -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">System Capabilities</h2>
			<div class="space-y-2 text-sm text-muted-foreground">
				<p>✓ Track software versions and PTF levels from vendor designations</p>
				<p>✓ Manage software packages for coordinated deployments</p>
				<p>✓ Monitor LPAR package levels and individual software installations</p>
				<p>✓ Support for individual product rollback capabilities</p>
				<p>✓ Multi-tenant customer environment support</p>
			</div>
		</Card>
	</div>
</div>
