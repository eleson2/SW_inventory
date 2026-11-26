<script lang="ts">
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import Card from '#lib/components/ui/Card.svelte';

	/** Reports by goal; `href` = built. IDs match the "Reporting Needs" document. */
	const groups: { title: string; reports: { id: string; name: string; text: string; href?: string }[] }[] = [
		{
			title: 'Installed software',
			reports: [
				{ id: 'R1', name: 'Installed software', text: 'Products × LPARs, compared with each LPAR’s package', href: '/reports/installed' },
				{ id: '', name: 'Software by customer', text: 'Per customer: software, version, number of LPARs', href: '/reports/software-by-customer' },
				{ id: 'R3', name: 'Vendor installed base', text: 'Per product and release: LPARs, customers, share and PTF levels; per customer on request', href: '/reports/vendor-base' },
				{ id: 'R2', name: 'Where used', text: 'One product or release: every LPAR running it', href: '/reports/where-used' },
				{ id: 'R4', name: 'Version sprawl', text: 'Distinct releases and PTF levels per product', href: '/reports/version-sprawl' }
			]
		},
		{
			title: 'Lifecycle (LCM)',
			reports: [
				{ id: 'L1', name: 'End-of-support horizon', text: 'Installed releases by end-of-support date; within 12 months highlighted', href: '/reports/end-of-support' },
				{ id: 'L2', name: 'Package compliance', text: 'Per LPAR: matching, behind, ahead, outside and missing vs its package, with %', href: '/reports/package-compliance' },
				{ id: 'L3', name: 'Rollout progress', text: 'Per package: LPARs initiated, planned (overdue), installed, superseded', href: '/reports/rollout' },
				{ id: 'L4', name: 'Maintenance level per LPAR', text: 'RSU/CARS level per LPAR and vendor, and its age', href: '/reports/maintenance-level' },
				{ id: 'L5', name: 'Open rollbacks', text: 'Rolled-back items not reapplied, oldest first', href: '/reports/open-rollbacks' }
			]
		},
		{
			title: 'Vendors',
			reports: [
				{ id: 'V1', name: 'Installed base summary', text: 'Per vendor: LPARs, customers, products, releases and installs, with the trend from installed packages', href: '/reports/installed-base' },
				{ id: 'V2', name: 'Low-footprint products', text: 'Products on few LPARs (limit you set) or only on test/dev, and products installed nowhere', href: '/reports/low-footprint' },
				{ id: 'V3', name: 'Overlapping products', text: 'Products of the same category from different vendors, and the LPARs running them side by side', href: '/reports/overlap' },
				{ id: 'V4', name: 'Quality record', text: 'Rollbacks per vendor and product in a chosen period', href: '/reports/quality' },
				{ id: 'V5', name: 'Support-date exposure', text: 'End-of-support horizon grouped by vendor', href: '/reports/end-of-support?group=vendor' },
				{ id: 'V6', name: 'Maintenance uptake', text: 'Per CARS/RSU level: LPARs that reached it', href: '/reports/maintenance-uptake' }
			]
		},
		{
			title: 'Customers',
			reports: [
				{ id: 'C1', name: 'Customer software statement', text: 'Printable per customer: systems, versions, status and recent changes', href: '/reports/customer-statement' },
				{ id: 'C4', name: 'End-of-support notice', text: 'Part of the customer statement: releases out of or ending support', href: '/reports/customer-statement' },
				{ id: 'C5', name: 'Currency score', text: 'Per customer: share current with package, behind, outside, out of support', href: '/reports/currency' }
			]
		}
	];
</script>

<svelte:head><title>Reports</title></svelte:head>

<div class="space-y-6">
	<PageHeader title="Reports" description="Every report uses the same filters: customers, LPARs, LPAR sets, vendors, products" />
	<p class="text-sm"><a href="/reports/lpar-sets" class="text-primary hover:underline">Manage LPAR sets</a></p>
	<div class="grid gap-6 md:grid-cols-2">
		{#each groups as group (group.title)}
			<Card class="p-5">
				<h2 class="text-lg font-semibold mb-3">{group.title}</h2>
				<ul class="space-y-2">
					{#each group.reports as r (r.name)}
						<li class="flex gap-3 text-sm">
							<span class="w-8 shrink-0 text-muted-foreground">{r.id}</span>
							<div>
								{#if r.href}
									<a href={r.href} class="font-medium text-primary hover:underline">{r.name}</a>
								{:else}
									<span class="font-medium text-muted-foreground">{r.name}</span>
									<span class="ml-1 rounded bg-gray-100 px-1.5 text-xs text-gray-600">planned</span>
								{/if}
								<div class="text-muted-foreground">{r.text}</div>
							</div>
						</li>
					{/each}
				</ul>
			</Card>
		{/each}
	</div>
</div>
