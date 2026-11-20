<script lang="ts">
	import type { PageData } from './$types';
	import type { PackageItem } from '#lib/schemas/package.ts';
	import { packageUpdateSchema } from '#lib/schemas/package.ts';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import Card from '#lib/components/ui/Card.svelte';
	import FormField from '#lib/components/common/FormField.svelte';
	import FormCheckbox from '#lib/components/common/FormCheckbox.svelte';
	import PackageItemsManager from '#lib/components/domain/PackageItemsManager.svelte';
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
		{ label: 'Packages', href: '/packages' },
		{ label: `${data.package.name} (${data.package.version})`, href: `/packages/${data.package.id}` },
		{ label: 'Edit' }
	];

	const { form, errors, enhance, submitting, delayed, posted, constraints, message } =
		typedSuperForm(data.form, packageUpdateSchema, {
			dataType: 'json',
			resetForm: false
		});

	// The date input works on YYYY-MM-DD strings; the schema coerces it back to a Date
	const toDateInput = (value: unknown) =>
		value instanceof Date ? value.toISOString().split('T')[0] : String(value ?? '');

	// Detail rows (package items), synced into $form for submission
	let packageItems = $state<PackageItem[]>($form.items ?? []);
	$effect(() => {
		$form.items = packageItems;
	});
</script>

<div class="space-y-6 max-w-4xl">
	<!-- Transaction ID -->
	<div class="flex justify-start mb-4">
		<TransactionId prefix="PKG-EDIT" label="Form ID" />
	</div>

	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit Package"
		description="Update package information and manage included software items"
	/>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$posted} />

		<!-- Master Entity: Package Information -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Information</h2>
			<div class="space-y-6">
				<FormField
					label="Package Name"
					id="name"
					name="name"
					bind:value={$form.name}
					placeholder="Enter package name"
					error={$errors.name?.[0]}
					constraints={$constraints.name}
				/>

				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Package Code"
						id="code"
						name="code"
						bind:value={$form.code}
						placeholder="PKG-CODE"
						helperText="Uppercase alphanumeric with dashes/underscores"
						error={$errors.code?.[0]}
						constraints={$constraints.code}
					/>

					<FormField
						label="Version"
						id="version"
						name="version"
						bind:value={$form.version}
						placeholder="e.g., 2025.1.0"
						error={$errors.version?.[0]}
						constraints={$constraints.version}
					/>
				</div>

				<FormField
					label="Release Date"
					id="release_date"
					name="release_date"
					type="date"
					bind:value={() => toDateInput($form.release_date), (v) => ($form.release_date = v as any)}
					required
					error={$errors.release_date?.[0]}
				/>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={$form.description as any}
					placeholder="Enter package description (optional)"
					constraints={$constraints.description}
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={() => $form.active ?? true, (v) => ($form.active = v)}
					constraints={$constraints.active}
				/>
			</div>
		</Card>

		<!-- Detail Entity: Package Items -->
		<Card class="p-6">
			<PackageItemsManager
				bind:items={packageItems}
				allSoftware={data.allSoftware}
			/>
		</Card>

		<!-- Form Actions -->
		<Card class="p-6">
			<div class="space-y-4">
				<FormErrorMessage message={$message} />
				<FormButtons loading={$submitting || $delayed} />
			</div>
		</Card>
	</form>
</div>
