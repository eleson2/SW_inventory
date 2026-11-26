<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import type { LparSoftwareInstallation } from '#lib/schemas/lpar.ts';
	import { lparWithSoftwareSchema } from '#lib/schemas/lpar.ts';
	import { typedSuperForm } from '#lib/utils/superforms.ts';
	import Card from '#lib/components/ui/Card.svelte';
	import Label from '#lib/components/ui/Label.svelte';
	import { ENVIRONMENTS, ENVIRONMENT_LABEL } from '#lib/utils/environment.ts';
	import FormField from '#lib/components/common/FormField.svelte';
	import FormCheckbox from '#lib/components/common/FormCheckbox.svelte';
	import FormButtons from '#lib/components/common/FormButtons.svelte';
	import LparSoftwareManager from '#lib/components/domain/LparSoftwareManager.svelte';
	import FormErrorMessage from '#lib/components/common/FormErrorMessage.svelte';
	import FormTextarea from '#lib/components/common/FormTextarea.svelte';
	import FormValidationSummary from '#lib/components/common/FormValidationSummary.svelte';
	import Breadcrumb from '#lib/components/common/Breadcrumb.svelte';
	import PageHeader from '#lib/components/common/PageHeader.svelte';
	import TransactionId from '#lib/components/common/TransactionId.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = $derived([
		{ label: 'Home', href: '/' },
		{ label: 'LPARs', href: '/lpars' },
		{ label: data.lpar.customers?.name || 'Customer', href: `/customers/${data.lpar.customer_id}` },
		{ label: data.lpar.name, href: `/lpars/${data.lpar.id}` },
		{ label: 'Edit' }
	]);

	const { form, errors, enhance, submitting, delayed, posted, constraints, message } =
		typedSuperForm(untrack(() => data.form), lparWithSoftwareSchema, {
			dataType: 'json',
			resetForm: false
		});

	// Detail rows (software installations), synced into $form for submission
	let softwareInstallations = $state<LparSoftwareInstallation[]>($form.software_installations);
	$effect(() => {
		$form.software_installations = softwareInstallations;
	});
</script>

<div class="space-y-6">
	<!-- Transaction ID -->
	<div class="flex justify-start mb-4">
		<TransactionId prefix="LPAR-EDIT" label="Form ID" />
	</div>

	<Breadcrumb items={breadcrumbItems} />

	<PageHeader
		title="Edit LPAR"
		description="Update LPAR information and manage software installations"
	/>

	<form method="POST" class="space-y-6" use:enhance>
		<FormValidationSummary errors={$errors} submitted={$posted} />

		<!-- LPAR Information Card -->
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">LPAR Details</h2>
			<div class="space-y-6">
				<FormField
					label="LPAR Name"
					id="name"
					name="name"
					bind:value={$form.name}
					placeholder="Enter LPAR name"
					error={$errors.name?.[0]}
					constraints={$constraints.name}
				/>

				<FormField
					label="LPAR Code"
					id="code"
					name="code"
					bind:value={$form.code}
					placeholder="LPAR-CODE"
					helperText="Uppercase alphanumeric with dashes/underscores"
					error={$errors.code?.[0]}
					constraints={$constraints.code}
				/>

				<div class="space-y-2">
					<Label for="customerId">Customer <span class="text-destructive">*</span></Label>
					<select
						id="customer_id"
						name="customer_id"
						bind:value={$form.customer_id}
						required
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						{#each data.customers as customer}
							<option value={customer.id}>{customer.name} ({customer.code})</option>
						{/each}
					</select>
					{#if $errors.customer_id?.[0]}
						<p class="text-sm text-destructive">{$errors.customer_id[0]}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="currentPackageId">Current Package</Label>
					<select
						id="current_package_id"
						name="current_package_id"
						bind:value={$form.current_package_id}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<option value="">None</option>
						{#each data.packages as pkg}
							<option value={pkg.id}>{pkg.name} ({pkg.code} {pkg.version})</option>
						{/each}
					</select>
					<p class="text-sm text-muted-foreground">Optional - can be changed later</p>
					{#if $errors.current_package_id?.[0]}
						<p class="text-sm text-destructive">{$errors.current_package_id[0]}</p>
					{/if}
				</div>

				<div class="space-y-2">
					<Label for="environment">Environment</Label>
					<select
						id="environment"
						name="environment"
						bind:value={$form.environment}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						<option value="">Not set</option>
						{#each ENVIRONMENTS as env (env)}<option value={env}>{env} – {ENVIRONMENT_LABEL[env]}</option>{/each}
					</select>
				</div>

				<FormTextarea
					label="Description"
					id="description"
					name="description"
					bind:value={$form.description as any}
					placeholder="Enter LPAR description (optional)"
					constraints={$constraints.description}
				/>

				<FormCheckbox
					label="Active"
					id="active"
					name="active"
					bind:checked={$form.active}
					constraints={$constraints.active}
				/>

				<FormErrorMessage message={$message} />
			</div>
		</Card>

		<!-- Software Installations Card -->
		<Card class="p-6">
			<LparSoftwareManager
				bind:installations={softwareInstallations}
				allSoftware={data.allSoftware}
				assignedPackage={data.lpar.packages}
				errors={$errors as any}
			/>
		</Card>

		<!-- Submit Buttons -->
		<Card class="p-6">
			<FormButtons loading={$submitting || $delayed} />
		</Card>
	</form>
</div>
