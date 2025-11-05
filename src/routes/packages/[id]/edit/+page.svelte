<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { PackageItem } from '$lib/schemas/package';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import PackageItemsManager from '$components/domain/PackageItemsManager.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import { useMasterDetailForm } from '$lib/utils/useMasterDetailForm.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Packages', href: '/packages' },
		{ label: `${data.package.name} (${data.package.version})`, href: `/packages/${data.package.id}` },
		{ label: 'Edit' }
	];

	// Format date for input field (YYYY-MM-DD)
	const formatDateForInput = (date: Date) => {
		const d = new Date(date);
		return d.toISOString().split('T')[0];
	};

	// Master entity data
	let formData = $state({
		name: data.package.name,
		code: data.package.code,
		version: data.package.version,
		description: data.package.description || '',
		release_date: formatDateForInput(data.package.release_date),
		active: data.package.active
	});

	// Detail entity data - transform from database format to form format
	let packageItems = $state<PackageItem[]>(
		data.package.package_items.map((item) => ({
			id: item.id,
			software_id: item.software_id,
			software_version_id: item.software_version_id,
			required: item.required,
			order_index: item.order_index
		}))
	);

	// Use master-detail form utility
	const { handleSubmit, submitting } = useMasterDetailForm({
		onBuildFormData: (formData) => {
			// Add items as JSON
			formData.set('items', JSON.stringify(packageItems));
		}
	});
</script>

<div class="space-y-6 max-w-4xl">
	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit Package"
		description="Update package information and manage included software items"
	/>

	<form method="POST" class="space-y-6" onsubmit={handleSubmit}>
		<!-- Master Entity: Package Information -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Package Information</h2>
			<div class="space-y-6">
				<FormField
					label="Package Name"
					id="name"
					name="name"
					bind:value={formData.name}
					required
					placeholder="Enter package name"
					error={form?.errors?.name?.[0]}
				/>

				<div class="grid grid-cols-2 gap-4">
					<FormField
						label="Package Code"
						id="code"
						name="code"
						bind:value={formData.code}
						required
						placeholder="PKG-CODE"
						helperText="Uppercase alphanumeric with dashes/underscores"
						error={form?.errors?.code?.[0]}
					/>

					<FormField
						label="Version"
						id="version"
						name="version"
						bind:value={formData.version}
						required
						placeholder="e.g., 2025.1.0"
						error={form?.errors?.version?.[0]}
					/>
				</div>

				<FormField
					label="Release Date"
					id="release_date"
					name="release_date"
					type="date"
					bind:value={formData.release_date}
					required
					error={form?.errors?.release_date?.[0]}
				/>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter package description (optional)"
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={formData.active}
				/>
			</div>
		</Card>

		<!-- Detail Entity: Package Items -->
		<Card class="p-6">
			<PackageItemsManager
				bind:items={packageItems}
				allSoftware={data.allSoftware}
				errors={form?.errors}
			/>
		</Card>

		<!-- Form Actions -->
		<Card class="p-6">
			<div class="space-y-4">
				<FormErrorMessage message={form?.message} />
				<FormButtons loading={submitting} />
			</div>
		</Card>
	</form>
</div>
