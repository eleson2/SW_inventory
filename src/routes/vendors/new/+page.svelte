<script lang="ts">
	// @ts-nocheck - Superforms type inference issues with client-side validation
	import type { PageData } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { zod } from 'sveltekit-superforms/adapters';
	import { vendorSchema } from '$schemas';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';
	import CloneModeToggle from '$components/common/CloneModeToggle.svelte';
	import PageHeader from '$components/common/PageHeader.svelte';
	import FormValidationSummary from '$components/common/FormValidationSummary.svelte';
	import Breadcrumb from '$components/common/Breadcrumb.svelte';

	let { data }: { data: PageData } = $props();

	const breadcrumbItems = [
		{ label: 'Home', href: '/' },
		{ label: 'Vendors', href: '/vendors' },
		{ label: 'New Vendor' }
	];

	// Initialize Superforms with client-side validation
	// @ts-expect-error - Superforms type inference issue with Zod validators
	const { form, errors, enhance, submitting, delayed, submitted, constraints } = superForm(data.form, {
		dataType: 'json',
		resetForm: false,
		validators: zod(vendorSchema)
	});

	let creationMode = $state<'blank' | 'clone'>('blank');
	let cloneSourceId = $state('');

	// When clone source is selected, pre-fill form
	function handleCloneSourceSelect(sourceId: string) {
		const source = data.allVendors.find((v) => v.id === sourceId);
		if (source) {
			$form.name = `${source.name} (Copy)`;
			$form.code = `${source.code}-COPY`;
			$form.website = source.website || '';
			$form.contact_email = source.contact_email || '';
			$form.active = source.active;
		}
	}

	// Reset form to blank state
	function handleBlankSelect() {
		$form.name = '';
		$form.code = '';
		$form.website = '';
		$form.contact_email = '';
		$form.active = true;
	}
</script>

<div class="space-y-6 max-w-2xl">
	<Breadcrumb items={breadcrumbItems} />
	<PageHeader title="New Vendor" description="Add a new software vendor to the system" />

	<Card class="p-6">
		<form method="POST" class="space-y-6" use:enhance>
			<FormValidationSummary errors={$errors} submitted={$submitted} />

			<!-- Required fields legend -->
			<p class="text-sm text-muted-foreground pb-2 border-b">
				<span class="text-destructive">*</span> Required fields
			</p>

			<!-- Creation Mode Toggle -->
			<CloneModeToggle
				entityName="Vendor"
				items={data.allVendors}
				displayField="name"
				secondaryField="code"
				bind:mode={creationMode}
				bind:selectedId={cloneSourceId}
				onModeChange={(mode) => {
					creationMode = mode;
				}}
				onSourceSelect={handleCloneSourceSelect}
				onBlankSelect={handleBlankSelect}
			/>

			<FormField
				label="Vendor Name"
				id="name"
				name="name"
				bind:value={$form.name}
				placeholder="Enter vendor name"
				error={$errors.name?._errors?.[0]}
				constraints={$constraints.name}
			/>

			<FormField
				label="Vendor Code"
				id="code"
				name="code"
				bind:value={$form.code}
				placeholder="VENDOR-CODE"
				helperText="Uppercase alphanumeric with dashes/underscores"
				error={$errors.code?._errors?.[0]}
				constraints={$constraints.code}
			/>

			<FormField
				label="Website"
				id="website"
				name="website"
				type="url"
				bind:value={$form.website}
				placeholder="https://www.example.com"
				helperText="Optional - full URL including https://"
				error={$errors.website?._errors?.[0]}
				constraints={$constraints.website}
			/>

			<FormField
				label="Contact Email"
				id="contact_email"
				name="contact_email"
				type="email"
				bind:value={$form.contact_email}
				placeholder="contact@example.com"
				helperText="Optional - main contact email for this vendor"
				error={$errors.contact_email?._errors?.[0]}
				constraints={$constraints.contact_email}
			/>

			<FormCheckbox
				label="Active"
				id="active"
				name="active"
				bind:checked={$form.active}
				constraints={$constraints.active}
			/>

			<FormButtons loading={$submitting || $delayed} />
		</form>
	</Card>
</div>
