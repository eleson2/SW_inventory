<script lang="ts">
	import type { PageData } from './$types';
	import type { BundleItem } from '#lib/schemas/bundle.ts';
	import { bundleSchema, nextBundleCode } from '#lib/schemas/bundle.ts';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import Card from '#lib/components/ui/Card.svelte';
	import Label from '#lib/components/ui/Label.svelte';
	import FormButtons from '#lib/components/common/FormButtons.svelte';
	import FormErrorMessage from '#lib/components/common/FormErrorMessage.svelte';
	import FormValidationSummary from '#lib/components/common/FormValidationSummary.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import BundleFormFields from '#lib/components/domain/BundleFormFields.svelte';
	import BundleItemsManager from '#lib/components/domain/BundleItemsManager.svelte';
	import { formatDate } from '#lib/utils/date-format.ts';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting, delayed, posted, message } = typedSuperForm(data.form, bundleSchema, {
		dataType: 'json',
		resetForm: false
	});

	let items = $state<BundleItem[]>([]);
	$effect(() => {
		$form.items = items;
	});

	let cloneSourceId = $state('');

	// Bundles of the selected vendor (or all, before a vendor is chosen)
	const cloneSources = $derived(
		data.allBundles.filter((b) => !$form.vendor_id || b.vendor_id === $form.vendor_id)
	);

	/** Start from an earlier bundle: same vendor/type/items, next level code */
	function cloneFrom(sourceId: string) {
		cloneSourceId = sourceId;
		const source = data.allBundles.find((b) => b.id === sourceId);
		if (!source) return;
		const code = nextBundleCode(source.code);
		$form.vendor_id = source.vendor_id;
		$form.bundle_type = source.bundle_type as typeof $form.bundle_type;
		$form.code = code;
		$form.name = code === source.code ? `${source.name} (Copy)` : source.name.replace(source.code, code);
		$form.release_date = new Date().toISOString().slice(0, 10) as any;
		$form.description = `Cloned from ${source.code}`;
		items = source.items.map((item) => ({
			software_id: item.software_id,
			software_version_id: item.software_version_id,
			notes: item.notes ?? undefined
		}));
	}

	if (data.cloneFrom) cloneFrom(data.cloneFrom);
</script>

<div class="space-y-6 max-w-5xl">
	<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Vendor Bundles', href: '/bundles' }, { label: 'New Bundle' }]} />

	<PageHeader
		title="New Vendor Bundle"
		description="Record a vendor maintenance level, e.g. Broadcom CARS2512 or IBM RSU2512"
	/>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$posted} />

		<Card class="p-6 space-y-3">
			<h2 class="text-xl font-semibold">Start From</h2>
			<p class="text-sm text-muted-foreground">
				Clone the previous level to carry over its contents, then bump the PTF levels below.
			</p>
			<div class="space-y-2 max-w-xl">
				<Label for="clone_source">Clone an existing bundle</Label>
				<select
					id="clone_source"
					value={cloneSourceId}
					onchange={(e) => (e.currentTarget.value ? cloneFrom(e.currentTarget.value) : (cloneSourceId = ''))}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<option value="">Blank bundle</option>
					{#each cloneSources as bundle}
						<option value={bundle.id}>
							{bundle.code} – {bundle.vendors.name} ({formatDate(bundle.release_date)}, {bundle.items.length} items)
						</option>
					{/each}
				</select>
			</div>
		</Card>

		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Bundle Information</h2>
			<BundleFormFields {form} {errors} vendors={data.vendors} />
		</Card>

		<Card class="p-6">
			<BundleItemsManager
				bind:items
				allSoftware={data.allSoftware}
				vendorId={$form.vendor_id}
				bundleCode={$form.code}
				bundleType={$form.bundle_type}
				errors={$errors.items}
			/>
		</Card>

		<Card class="p-6 space-y-4">
			<FormErrorMessage message={$message} />
			<FormButtons loading={$submitting || $delayed} />
		</Card>
	</form>
</div>
