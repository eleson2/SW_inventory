<!--
	BundleFormFields.svelte
	Master fields of a vendor bundle, shared by /bundles/new and /bundles/[id]/edit.
	Receives the Superforms stores of the page.
-->
<script lang="ts">
	import type { Writable, Readable } from 'svelte/store';
	import FormField from '#lib/components/common/FormField.svelte';
	import FormSelect from '#lib/components/common/FormSelect.svelte';
	import FormTextarea from '#lib/components/common/FormTextarea.svelte';
	import FormCheckbox from '#lib/components/common/FormCheckbox.svelte';
	import Label from '#lib/components/ui/Label.svelte';
	import { BUNDLE_TYPES } from '#lib/schemas/bundle.ts';

	interface Props {
		form: Writable<any>;
		errors: Readable<any>;
		vendors: Array<{ id: string; name: string; code: string }>;
	}

	let { form, errors, vendors }: Props = $props();

	// The date input works on YYYY-MM-DD strings; the schema coerces it back to a Date
	const toDateInput = (value: unknown) =>
		value instanceof Date ? value.toISOString().split('T')[0] : String(value ?? '').slice(0, 10);

	function onCodeInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cursor = input.selectionStart;
		$form.code = input.value.toUpperCase();
		// Suggest the type from the code prefix while it is still the default
		if ($form.code.startsWith('CARS')) $form.bundle_type = 'CARS';
		else if ($form.code.startsWith('RSU')) $form.bundle_type = 'RSU';
		setTimeout(() => input.setSelectionRange(cursor, cursor), 0);
	}
</script>

<div class="space-y-6">
	<div class="grid gap-4 md:grid-cols-2">
		<FormSelect
			label="Vendor"
			id="vendor_id"
			name="vendor_id"
			bind:value={$form.vendor_id}
			options={vendors}
			valueField="id"
			displayField="name"
			placeholder="Select vendor..."
			required
			error={$errors.vendor_id?.[0]}
		/>

		<div class="space-y-2">
			<Label for="bundle_type">Bundle Type</Label>
			<select
				id="bundle_type"
				name="bundle_type"
				bind:value={$form.bundle_type}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				{#each BUNDLE_TYPES as type}
					<option value={type}>
						{type === 'CARS' ? 'CARS (Broadcom CA RS)' : type === 'RSU' ? 'RSU (IBM Recommended Service Upgrade)' : 'Other'}
					</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<FormField
			label="Code"
			id="code"
			name="code"
			bind:value={$form.code}
			placeholder="CARS2511"
			helperText="Vendor level identifier, e.g. CARS2511 or RSU2511"
			error={$errors.code?.[0]}
			oninput={onCodeInput}
		/>

		<FormField
			label="Release Date"
			id="release_date"
			name="release_date"
			type="date"
			bind:value={() => toDateInput($form.release_date), (v) => ($form.release_date = v as any)}
			required
			error={$errors.release_date?.[0]}
		/>
	</div>

	<FormField
		label="Name"
		id="name"
		name="name"
		bind:value={$form.name}
		placeholder="Broadcom CA RS November 2025"
		error={$errors.name?.[0]}
	/>

	<FormField
		label="Source URL"
		id="source_url"
		name="source_url"
		bind:value={$form.source_url as any}
		placeholder="https://... (optional)"
		error={$errors.source_url?.[0]}
	/>

	<FormTextarea
		label="Description"
		id="description"
		name="description"
		bind:value={$form.description as any}
		placeholder="Notes about this maintenance level (optional)"
	/>

	<FormCheckbox
		label="Active"
		id="active"
		name="active"
		bind:checked={() => $form.active ?? true, (v) => ($form.active = v)}
	/>
</div>
