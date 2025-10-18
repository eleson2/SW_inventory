<script lang="ts">
	import type { PageData } from './$types';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import { formatDateTime } from '$utils/date-format';

	let { data }: { data: PageData } = $props();
	const { customer } = data;
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{customer.name}</h1>
			<p class="text-muted-foreground mt-2">Customer Details and Configuration</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" onclick={() => window.location.href = `/customers/${customer.id}/edit`}>
				Edit
			</Button>
			<Button variant="outline" onclick={() => window.history.back()}>
				Back
			</Button>
		</div>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Basic Information</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Customer Code</dt>
					<dd class="text-sm mt-1 font-mono">{customer.code}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Description</dt>
					<dd class="text-sm mt-1">{customer.description || '-'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1">
						<StatusBadge active={customer.active} />
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Created</dt>
					<dd class="text-sm mt-1">{formatDateTime(new Date(customer.created_at))}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Last Updated</dt>
					<dd class="text-sm mt-1">{formatDateTime(new Date(customer.updated_at))}</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Statistics</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Total LPARs</dt>
					<dd class="text-2xl font-bold mt-1">{customer.lpars.length}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Active LPARs</dt>
					<dd class="text-2xl font-bold mt-1">
						{customer.lpars.filter((lpar: { active: boolean }) => lpar.active).length}
					</dd>
				</div>
			</dl>
		</Card>
	</div>

	<Card class="p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold">LPARs</h2>
			<Button size="sm" onclick={() => window.location.href = '/lpars/new'}>
				Add LPAR
			</Button>
		</div>

		{#if customer.lpars.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No LPARs configured for this customer</p>
		{:else}
			<div class="space-y-3">
				{#each customer.lpars as lpar}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="font-medium">
								<a href="/lpars/{lpar.id}" class="text-primary hover:underline">
									{lpar.name}
								</a>
							</div>
							<div class="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
								<span class="font-mono">{lpar.code}</span>
								{#if lpar.packages}
									<span>•</span>
									<Badge variant="outline">
										{lpar.packages.code} ({lpar.packages.version})
									</Badge>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-4">
							<div class="text-sm text-muted-foreground">
								{lpar.lpar_software?.length || 0} software installed
							</div>
							<StatusBadge active={lpar.active} />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>
