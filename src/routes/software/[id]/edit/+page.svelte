<script lang="ts">
	import type { PageData } from './$types';
	import { softwareWithVersionsSchema } from '#lib/schemas/software.ts';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import Card from '#lib/components/ui/Card.svelte';
	import FormField from '#lib/components/common/FormField.svelte';
	import FormCheckbox from '#lib/components/common/FormCheckbox.svelte';
	import FormSelect from '#lib/components/common/FormSelect.svelte';
	import VersionManager from '#lib/components/domain/VersionManager.svelte';
	import FormButtons from '#lib/components/common/FormButtons.svelte';
	import FormErrorMessage from '#lib/components/common/FormErrorMessage.svelte';
	import FormTextarea from '#lib/components/common/FormTextarea.svelte';
	import FormValidationSummary from '#lib/components/common/FormValidationSummary.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import TransactionId from '#lib/components/common/TransactionId.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Software', href: '/software' },
		{ label: data.software.vendors?.name || 'Vendor', href: `/vendors/${data.software.vendor_id}` },
		{ label: data.software.name, href: `/software/${data.software.id}` },
		{ label: 'Edit' }
	];

	const { form, errors, enhance, submitting, delayed, posted, constraints, message } =
		typedSuperForm(data.form, softwareWithVersionsSchema, {
			dataType: 'json',
			resetForm: false
		});

	// Detail rows (versions), synced into $form for submission
	let versions = $state<any[]>($form.versions);
	$effect(() => {
		$form.versions = versions;
	});
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Transaction ID -->
	<div class="flex justify-start mb-4">
		<TransactionId prefix="SW-EDIT" label="Form ID" />
	</div>

	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit Software"
		description="Update software product information and manage versions"
	/>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$posted} />

		<!-- Master Entity: Software Information -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Software Details</h2>
			<div class="space-y-6">
				<FormField
					label="Software Name"
					id="name"
					name="name"
					bind:value={$form.name}
					placeholder="Enter software name"
					error={$errors.name?.[0]}
					constraints={$constraints.name}
				/>

				<FormSelect
					label="Vendor"
					id="vendor_id"
					name="vendor_id"
					bind:value={$form.vendor_id}
					options={data.vendors}
					valueField="id"
					displayField="name"
					secondaryField="code"
					required
					error={$errors.vendor_id?.[0]}
				/>

				<FormField
					label="Vendor Product Code"
					id="product_code"
					name="product_code"
					bind:value={$form.product_code as any}
					placeholder="e.g. AL2120 (optional)"
					helperText="Vendor's product/FMID code; used to match products when importing vendor bundles"
					error={$errors.product_code?.[0]}
				/>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={$form.description as any}
					placeholder="Enter software description (optional)"
					constraints={$constraints.description}
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={$form.active}
					constraints={$constraints.active}
				/>
			</div>
		</Card>

		<!-- Detail Entity: Version Management -->
		<VersionManager bind:versions onVersionsChange={(updated) => (versions = updated)} errors={$errors as any} />

		<!-- Form Actions -->
		<FormErrorMessage message={$message} />

		<FormButtons loading={$submitting || $delayed} />
	</form>
</div>
