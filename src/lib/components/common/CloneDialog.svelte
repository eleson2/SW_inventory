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
		initialValues = {},
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
		initialValues?: Record<string, string>;
		preview?: Record<string, any>;
		onClone: (data: Record<string, string>) => Promise<void>;
		loading?: boolean;
	} = $props();

	// Initialize formData immediately with initial values or empty strings
	let formData = $state<Record<string, string>>(
		fields.reduce((acc, field) => ({
			...acc,
			[field.name]: initialValues[field.name] || ''
		}), {} as Record<string, string>)
	);
	let errors = $state<Record<string, string>>({});

	function resetForm() {
		formData = fields.reduce((acc, field) => ({
			...acc,
			[field.name]: initialValues[field.name] || ''
		}), {});
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
						{#if field.name === 'description'}
							<div class="space-y-2">
								<Label for={field.name}>
									{field.label}
									{#if field.required}<span class="text-destructive">*</span>{/if}
								</Label>
								<textarea
									id={field.name}
									name={field.name}
									bind:value={formData[field.name]}
									placeholder={field.placeholder}
									required={field.required}
									class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								></textarea>
								{#if errors[field.name]}
									<p class="text-sm text-destructive">{errors[field.name]}</p>
								{/if}
								{#if field.helperText}
									<p class="text-sm text-muted-foreground">{field.helperText}</p>
								{/if}
							</div>
						{:else}
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
						{/if}
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
