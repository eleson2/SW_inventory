<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { PackageItem } from '$lib/schemas/package';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import FormCheckbox from '$components/common/FormCheckbox.svelte';
	import Label from '$components/ui/Label.svelte';
	import PackageItemsManager from '$components/domain/PackageItemsManager.svelte';
	import FormButtons from '$components/common/FormButtons.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

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

	// Handle form submission with master-detail data
	let submitting = $state(false);

	async function handleSubmit(event: Event) {
		event.preventDefault();
		submitting = true;

		const form = event.target as HTMLFormElement;
		const formDataToSend = new FormData(form);

		// Add items as JSON
		formDataToSend.set('items', JSON.stringify(packageItems));

		try {
			const response = await fetch(form.action, {
				method: 'POST',
				body: formDataToSend
			});

			if (response.redirected) {
				window.location.href = response.url;
			} else {
				// Handle validation errors
				const result = await response.json();
				if (!result.success) {
					// Errors will be in form prop on next render
					submitting = false;
				}
			}
		} catch (error) {
			console.error('Submission error:', error);
			submitting = false;
		}
	}
</script>

<div class="space-y-6 max-w-4xl">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Edit Package</h1>
		<p class="text-muted-foreground mt-2">
			Update package information and manage included software items
		</p>
	</div>

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

				<div class="space-y-2">
					<Label for="description">Description</Label>
					<textarea
						id="description"
						name="description"
						bind:value={formData.description}
						placeholder="Enter package description (optional)"
						class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					></textarea>
				</div>

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
			{#if form?.message}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
					{form.message}
				</div>
			{/if}

			<FormButtons loading={submitting} />
		</Card>
	</form>
</div>
