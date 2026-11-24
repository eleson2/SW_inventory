<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { BundleItem } from '#lib/schemas/bundle.ts';
	import { bundleUpdateSchema } from '#lib/schemas/bundle.ts';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import Card from '#lib/components/ui/Card.svelte';
	import FormButtons from '#lib/components/common/FormButtons.svelte';
	import FormErrorMessage from '#lib/components/common/FormErrorMessage.svelte';
	import FormValidationSummary from '#lib/components/common/FormValidationSummary.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import BundleFormFields from '#lib/components/domain/BundleFormFields.svelte';
	import BundleItemsManager from '#lib/components/domain/BundleItemsManager.svelte';

	let { data }: { data: PageData } = $props();

	const { form, errors, enhance, submitting, delayed, posted, message } = typedSuperForm(
		untrack(() => data.form),
		bundleUpdateSchema,
		{ dataType: 'json', resetForm: false }
	);

	let items = $state<BundleItem[]>($form.items ?? []);
	$effect(() => {
		$form.items = items;
	});
</script>

<div class="space-y-6 max-w-5xl">
	<Breadcrumb
		items={[
			{ label: 'Home', href: '/' },
			{ label: 'Vendor Bundles', href: '/bundles' },
			{ label: data.bundle.code, href: `/bundles/${data.bundle.id}` },
			{ label: 'Edit' }
		]}
	/>

	<PageHeader
		title="Edit {data.bundle.code}"
		description="Changes here do not alter packages already built from this bundle"
	/>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$posted} />

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
