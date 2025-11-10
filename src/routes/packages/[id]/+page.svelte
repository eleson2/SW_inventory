<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import StatusBadge from '$components/common/StatusBadge.svelte';
	import DeleteButton from '$components/common/DeleteButton.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import CloneDialog from '$components/common/CloneDialog.svelte';
	import { formatDate } from '$utils/date-format';
	import { createCloneHandler } from '$utils/clone-handler';

	let { data }: { data: PageData } = $props();
	const { package: pkg } = data;

	let showCloneDialog = $state(false);
	let cloning = $state(false);

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Packages', href: '/packages' },
		{ label: `${pkg.name} (${pkg.version})` }
	];

	const handleClone = async (formData: Record<string, string>) => {
		cloning = true;
		try {
			const cloneHandler = createCloneHandler({
				entityType: 'package',
				sourceId: pkg.id,
				redirectPath: (id) => `/packages/${id}`,
				errorMessage: 'Failed to clone package'
			});
			await cloneHandler(formData);
		} finally {
			cloning = false;
			showCloneDialog = false;
		}
	};
</script>

<div class="space-y-6">
	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title={pkg.name}
		description="Package Details and Software Items"
	>
		{#snippet actions()}
			<Button onclick={() => goto(`/packages/${pkg.id}/deploy`)}>
				Deploy Package
			</Button>
			<Button variant="outline" onclick={() => showCloneDialog = true}>
				Clone Package
			</Button>
			<Button variant="outline" onclick={() => goto(`/packages/${pkg.id}/edit`)}>
				Edit
			</Button>
			<DeleteButton
				entityName="Package"
				entityId={pkg.id}
				entityLabel={pkg.name}
				variant="destructive"
			/>
			<Button variant="outline" onclick={() => window.history.back()}>
				Back
			</Button>
		{/snippet}
	</PageHeader>

	<div class="grid gap-6 md:grid-cols-2">
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Basic Information</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Package Code</dt>
					<dd class="mt-1">
						<Badge variant="outline">{pkg.code}</Badge>
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Version</dt>
					<dd class="mt-1">
						<Badge>{pkg.version}</Badge>
					</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Release Date</dt>
					<dd class="text-sm mt-1">{formatDate(new Date(pkg.release_date))}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Description</dt>
					<dd class="text-sm mt-1">{pkg.description || '-'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Status</dt>
					<dd class="mt-1">
						<StatusBadge active={pkg.active} />
					</dd>
				</div>
			</dl>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Statistics</h2>
			<dl class="space-y-3">
				<div>
					<dt class="text-sm font-medium text-muted-foreground">Total Software Items</dt>
					<dd class="text-2xl font-bold mt-1">{pkg.package_items.length}</dd>
				</div>
			</dl>
		</Card>
	</div>

	<Card class="p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold">Package Items</h2>
			<Button size="sm" onclick={() => goto(`/packages/${pkg.id}/edit`)}>
				Manage Items
			</Button>
		</div>

		{#if pkg.package_items.length === 0}
			<p class="text-sm text-muted-foreground text-center py-8">No items in this package</p>
		{:else}
			<div class="space-y-3">
				{#each pkg.package_items as item}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<div>
									<div class="font-medium">
										<a
											href="/software/{item.software.id}"
											class="text-primary hover:underline"
										>
											{item.software.name}
										</a>
									</div>
									<div class="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
										<span>{item.software.vendors.name}</span>
										<span>•</span>
										<VersionDisplay
											version={{
												version: item.version,
												ptfLevel: item.ptf_level ?? undefined
											}}
											showBadge={true}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>

<CloneDialog
	bind:open={showCloneDialog}
	title="Clone Package"
	entityType="Package"
	sourceName={pkg.name}
	fields={[
		{ name: 'name', label: 'New Package Name', required: true, placeholder: 'Enter new package name' },
		{ name: 'code', label: 'New Package Code', required: true, placeholder: 'e.g., MF-Q2-2025' },
		{ name: 'version', label: 'New Version', required: true, placeholder: 'e.g., 2025.2.0' }
	]}
	preview={{
		code: pkg.code,
		version: pkg.version,
		'item count': pkg.package_items.length
	}}
	onClone={handleClone}
	loading={cloning}
/>
