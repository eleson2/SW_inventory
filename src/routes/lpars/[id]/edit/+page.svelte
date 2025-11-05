<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { LparSoftwareInstallation } from '$lib/schemas/lpar';
	import Card from '$components/ui/Card.svelte';
	import Label from '$components/ui/Label.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import LparSoftwareManager from '$components/domain/LparSoftwareManager.svelte';
	import FormErrorMessage from '$components/common/FormErrorMessage.svelte';
	import FormTextarea from '$components/common/FormTextarea.svelte';
	import { useMasterDetailForm } from '$lib/utils/useMasterDetailForm.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'LPARs', href: '/lpars' },
		{ label: data.lpar.customers?.name || 'Customer', href: `/customers/${data.lpar.customer_id}` },
		{ label: data.lpar.name, href: `/lpars/${data.lpar.id}` },
		{ label: 'Edit' }
	];

	// Helper to safely access errors
	const errors = $derived(
		form && 'errors' in form ? form.errors as Record<string, string[]> : undefined
	);

	// Master form data (LPAR)
	let formData = $state({
		name: data.lpar.name,
		code: data.lpar.code,
		customer_id: data.lpar.customer_id,
		description: data.lpar.description || '',
		current_package_id: data.lpar.current_package_id || '',
		active: data.lpar.active
	});

	// Detail form data (software installations)
	// Need to derive software_version_id from the denormalized version data
	let softwareInstallations = $state<LparSoftwareInstallation[]>(
		data.lpar.lpar_software.map((ls) => {
			// Find the matching version ID by looking up version and PTF level
			const software = data.allSoftware.find(s => s.id === ls.software_id);
			const matchingVersion = software?.versions.find(v =>
				v.version === ls.current_version &&
				(v.ptf_level || null) === (ls.current_ptf_level || null)
			);

			return {
				id: ls.id,
				software_id: ls.software_id,
				software_version_id: matchingVersion?.id || '',
				installed_date: ls.installed_date,
				_action: undefined
			};
		})
	);

	// Use master-detail form utility
	const { handleSubmit, submitting } = useMasterDetailForm({
		onBuildFormData: (formData) => {
			// Add installations as JSON
			formData.set('software_installations', JSON.stringify(softwareInstallations));
		}
	});
</script>

<div class="space-y-6">
	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit LPAR"
		description="Update LPAR information and manage software installations"
	/>

	<form method="POST" class="space-y-6" onsubmit={handleSubmit}>
		<!-- LPAR Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">LPAR Details</h2>
			<div class="space-y-6">
				<FormField
					label="LPAR Name"
					id="name"
					name="name"
					bind:value={formData.name}
					required
					placeholder="Enter LPAR name"
					error={errors?.name?.[0]}
				/>

				<FormField
					label="LPAR Code"
					id="code"
					name="code"
					bind:value={formData.code}
					required
					placeholder="LPAR-CODE"
					helperText="Uppercase alphanumeric with dashes/underscores"
					error={errors?.code?.[0]}
				/>

				<div class="space-y-2">
					<Label for="customerId">Customer <span class="text-destructive">*</span></Label>
					<select
						id="customer_id"
						name="customer_id"
						bind:value={formData.customer_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{#each data.customers as customer}
							<option value={customer.id}>{customer.name} ({customer.code})</option>
						{/each}
					</select>
					{#if errors?.customer_id?.[0]}
						<p class="text-sm text-destructive">{errors.customer_id[0]}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="currentPackageId">Current Package</Label>
					<select
						id="current_package_id"
						name="current_package_id"
						bind:value={formData.current_package_id}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<option value="">None</option>
						{#each data.packages as pkg}
							<option value={pkg.id}>{pkg.name} ({pkg.code} {pkg.version})</option>
						{/each}
					</select>
					<p class="text-sm text-muted-foreground">Optional - can be changed later</p>
					{#if errors?.current_package_id?.[0]}
						<p class="text-sm text-destructive">{errors.current_package_id[0]}</p>
					{/if}
				</div>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={formData.description}
					placeholder="Enter LPAR description (optional)"
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={formData.active}
				/>

				<FormErrorMessage message={form?.message} />
			</div>
		</Card>

		<!-- Software Installations Card -->
		<Card class="p-6">
			<LparSoftwareManager
				bind:installations={softwareInstallations}
				allSoftware={data.allSoftware}
				assignedPackage={data.lpar.packages}
				errors={errors}
			/>
		</Card>

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons loading={submitting} />
		</Card>
	</form>
</div>
