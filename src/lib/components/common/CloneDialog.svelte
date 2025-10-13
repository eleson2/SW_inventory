<script lang="ts">
	import Button from '$components/ui/Button.svelte';
	import Card from '$components/ui/Card.svelte';
	import FormField from '$components/common/FormField.svelte';
	import Label from '$components/ui/Label.svelte';

	let {
		open = $bindable(false),
		title = 'Clone Item',
		entityType,
		sourceName,
		fields = [],
		preview = {},
		onClone,
		loading = false
	}: {
		open?: boolean;
		title?: string;
		entityType: string;
		sourceName: string;
		fields: Array<{
			name: string;
			label: string;
			type?: string;
			required?: boolean;
			placeholder?: string;
			helperText?: string;
		}>;
		preview?: Record<string, any>;
		onClone: (data: Record<string, string>) => Promise<void>;
		loading?: boolean;
	} = $props();

	let formData = $state<Record<string, string>>({});
	let errors = $state<Record<string, string>>({});

	function resetForm() {
		formData = {};
		errors = {};
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		errors = {};

		// Basic validation
		for (const field of fields) {
			if (field.required && !formData[field.name]) {
				errors[field.name] = `${field.label} is required`;
			}
		}

		if (Object.keys(errors).length > 0) {
			return;
		}

		await onClone(formData);
	}

	function handleCancel() {
		resetForm();
		open = false;
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card class="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<h2 class="text-2xl font-bold mb-4">{title}</h2>

				<div class="mb-6 p-4 bg-muted rounded-lg">
					<h3 class="font-semibold mb-2">Cloning from:</h3>
					<p class="text-sm text-muted-foreground mb-3">{sourceName}</p>

					{#if Object.keys(preview).length > 0}
						<div class="space-y-1 text-sm">
							{#each Object.entries(preview) as [key, value]}
								{#if value !== null && value !== undefined}
									<div class="flex justify-between">
										<span class="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
										<span class="font-medium">{value}</span>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<form onsubmit={handleSubmit} class="space-y-4">
					{#each fields as field}
						<FormField
							label={field.label}
							id={field.name}
							name={field.name}
							type={field.type || 'text'}
							bind:value={formData[field.name]}
							placeholder={field.placeholder}
							required={field.required}
							error={errors[field.name]}
							helperText={field.helperText}
						/>
					{/each}

					<div class="flex gap-4 pt-4">
						<Button type="submit" disabled={loading}>
							{loading ? 'Cloning...' : `Clone ${entityType}`}
						</Button>
						<Button type="button" variant="outline" onclick={handleCancel} disabled={loading}>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</Card>
	</div>
{/if}
