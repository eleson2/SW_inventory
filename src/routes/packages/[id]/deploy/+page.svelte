<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import DualListbox from '$components/common/DualListbox.svelte';
	import ConfirmationDialog from '$components/common/ConfirmationDialog.svelte';
	import DeploymentProgress from '$components/common/DeploymentProgress.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	type LparWithStatus = (typeof data.lpars)[0];

	let availableLpars = $state<LparWithStatus[]>(data.lpars);
	let selectedLpars = $state<LparWithStatus[]>([]);

	let deploymentMode = $state<'sequential' | 'parallel'>('sequential');
	let stopOnError = $state(true);
	let showConfirmation = $state(false);
	let previewData = $state<any>(null);
	let isDeploying = $state(false);
	let isLoadingPreview = $state(false);
	let deployFormRef = $state<HTMLFormElement>();

	// Calculate summary stats
	const summary = $derived(() => {
		const total = selectedLpars.length;
		const changes = selectedLpars.reduce((sum, lpar) => sum + lpar.changesNeeded, 0);
		const newInstalls = selectedLpars.reduce((sum, lpar) => sum + lpar.newInstalls, 0);
		return { total, changes, newInstalls };
	});

	function getLabel(lpar: LparWithStatus): string {
		return `${lpar.customer.name} - ${lpar.name}`;
	}

	function getSubLabel(lpar: LparWithStatus): string {
		if (lpar.currentPackage) {
			return `Current: ${lpar.currentPackage.name} (${lpar.currentPackage.version})`;
		}
		return 'No package assigned';
	}

	function getStatusIcon(lpar: LparWithStatus): string {
		if (lpar.isCompliant) return '✅';
		if (lpar.changesNeeded + lpar.newInstalls > 0) return '⚠️';
		return '';
	}

	function getStatusColor(lpar: LparWithStatus): string {
		if (lpar.isCompliant) return 'text-green-600';
		if (lpar.changesNeeded + lpar.newInstalls > 0) return 'text-amber-600';
		return 'text-muted-foreground';
	}

	function groupBy(lpar: LparWithStatus): string {
		return lpar.customer.name;
	}

	async function loadPreview() {
		if (selectedLpars.length === 0) {
			previewData = null;
			return;
		}

		isLoadingPreview = true;
		const lparIds = selectedLpars.map((l) => l.id);

		try {
			const response = await fetch(`?/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					lpar_ids: JSON.stringify(lparIds)
				})
			});

			const result = await response.json();
			console.log('Preview response:', result);
			console.log('Response type:', result.type);
			console.log('Response data:', result.data);

			// SvelteKit wraps form action responses
			if (result.type === 'success' && result.data) {
				// Extract data - handle both direct object and devalue-serialized array
				const data = Array.isArray(result.data) ? result.data[0] : result.data;
				console.log('Extracted data:', data);
				console.log('Data has success?', data?.success);
				console.log('Data has previews?', data?.previews);

				if (data?.success && data?.previews) {
					previewData = data.previews;
					console.log('Preview data set:', previewData);
				} else {
					console.error('Preview failed - no success in data:', data);
					console.error('data.success =', data?.success);
					console.error('data.previews =', data?.previews);
					previewData = null;
				}
			} else {
				console.error('Preview failed - wrong type or no data');
				console.error('result.type =', result.type);
				console.error('result.data =', result.data);
				previewData = null;
			}
		} catch (error) {
			console.error('Preview error:', error);
			previewData = null;
		} finally {
			isLoadingPreview = false;
			console.log('previewData length:', previewData?.length);
		}
	}

	// Auto-load preview when LPARs are selected
	$effect(() => {
		if (selectedLpars.length > 0) {
			loadPreview();
		} else {
			previewData = null;
		}
	});

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function handleDeployClick() {
		showConfirmation = true;
	}

	function handleConfirmDeploy() {
		isDeploying = true;
		deployFormRef?.requestSubmit();
	}

	function handleCancelDeploy() {
		showConfirmation = false;
	}

	// Generate confirmation details
	const confirmationDetails = $derived(() => {
		const details: string[] = [];

		selectedLpars.forEach((lpar) => {
			const status = lpar.isCompliant
				? '✅ Compliant'
				: `⚠️ ${lpar.changesNeeded + lpar.newInstalls} changes needed`;
			details.push(`• ${lpar.customer.name} - ${lpar.name} (${status})`);
		});

		return details;
	});
</script>

<div class="space-y-6 max-w-7xl">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Deploy Package</h1>
		<p class="text-muted-foreground mt-2">
			Select target LPARs and deploy package to update software installations
		</p>
	</div>

	<!-- Package Info Card -->
	<Card class="p-6">
		<div class="flex items-start justify-between">
			<div>
				<h2 class="text-xl font-semibold">{data.package.name}</h2>
				<div class="flex gap-3 mt-2 text-sm text-muted-foreground">
					<span>Code: {data.package.code}</span>
					<span>•</span>
					<span>Version: {data.package.version}</span>
					<span>•</span>
					<span>Released: {formatDate(data.package.release_date)}</span>
				</div>
			</div>
			<Badge variant={data.package.active ? 'default' : 'secondary'}>
				{data.package.active ? 'Active' : 'Inactive'}
			</Badge>
		</div>

		{#if data.package.description}
			<p class="mt-3 text-sm text-muted-foreground">
				{data.package.description}
			</p>
		{/if}

		<div class="mt-4 pt-4 border-t border-border">
			<h3 class="text-sm font-medium mb-2">Package Contents:</h3>
			<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
				{#each data.package.package_items as item}
					<div class="text-sm">
						<span class="font-medium">{item.software.name}</span>
						<span class="text-muted-foreground">
							v{item.software_version.version}
							{#if item.software_version.ptf_level}
								({item.software_version.ptf_level})
							{/if}
						</span>
						{#if item.required}
							<Badge variant="secondary" class="ml-1 text-xs">Required</Badge>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</Card>

	<!-- Dual Listbox for LPAR Selection -->
	<Card class="p-6">
		<h2 class="text-xl font-semibold mb-4">Select Target LPARs</h2>
		<DualListbox
			bind:available={availableLpars}
			bind:selected={selectedLpars}
			{getLabel}
			{getSubLabel}
			{getStatusIcon}
			{getStatusColor}
			{groupBy}
			availableTitle="Available LPARs"
			selectedTitle="Selected for Deployment"
		/>
	</Card>

	<!-- Deployment Options -->
	{#if selectedLpars.length > 0}
		<Card class="p-6">
			<h2 class="text-xl font-semibold mb-4">Deployment Options</h2>

			<div class="space-y-4">
				<!-- Summary -->
				<div class="rounded-md bg-muted p-4">
					<div class="flex items-center gap-2 text-sm">
						<span class="font-medium">Impact Summary:</span>
						<span
							>{summary().total} LPAR{summary().total !== 1 ? 's' : ''} selected,</span
						>
						<span>{summary().changes} version change{summary().changes !== 1 ? 's' : ''},</span>
						<span
							>{summary().newInstalls} new installation{summary().newInstalls !== 1
								? 's'
								: ''}</span
						>
					</div>
				</div>

				<!-- Deployment Mode -->
				<div class="space-y-2">
					<label class="text-sm font-medium">Deployment Strategy</label>
					<div class="flex gap-4">
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								bind:group={deploymentMode}
								value="sequential"
								class="rounded-full"
							/>
							<div>
								<div class="text-sm font-medium">Sequential</div>
								<div class="text-xs text-muted-foreground">Deploy one at a time (safer)</div>
							</div>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="radio"
								bind:group={deploymentMode}
								value="parallel"
								class="rounded-full"
							/>
							<div>
								<div class="text-sm font-medium">Parallel</div>
								<div class="text-xs text-muted-foreground">Deploy simultaneously (faster)</div>
							</div>
						</label>
					</div>
				</div>

				<!-- Error Handling -->
				<div class="space-y-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={stopOnError} class="rounded" />
						<div>
							<div class="text-sm font-medium">Stop on first error</div>
							<div class="text-xs text-muted-foreground">
								Halt deployment if any LPAR fails (recommended)
							</div>
						</div>
					</label>
				</div>
			</div>
		</Card>

		<!-- Deployment Preview (Auto-shown) -->
		{#if isLoadingPreview}
			<Card class="p-6">
				<div class="flex items-center justify-center gap-3 py-8">
					<div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
					<span class="text-muted-foreground">Loading deployment preview...</span>
				</div>
			</Card>
		{:else if previewData === null && selectedLpars.length > 0}
			<Card class="p-6 border-destructive">
				<div class="text-center text-destructive py-8">
					<p class="font-semibold mb-2">⚠️ Failed to load deployment preview</p>
					<p class="text-sm text-muted-foreground">
						Check the browser console for errors. The server may be unable to calculate the deployment impact.
					</p>
				</div>
			</Card>
		{:else if previewData && previewData.length > 0}
			<Card class="p-6 border-primary">
				<div class="mb-4">
					<h2 class="text-xl font-semibold">Deployment Impact Preview</h2>
					<p class="text-sm text-muted-foreground mt-1">
						Review the changes that will be made to each selected LPAR
					</p>
				</div>

				<div class="space-y-4 max-h-[500px] overflow-y-auto">
					{#each previewData as preview}
						<div class="border border-border rounded-lg p-4">
							<h3 class="font-medium mb-2 flex items-center gap-2">
								{preview.lparName} ({preview.lparCode})
								<Badge variant="outline" class="text-xs">
									{preview.changes.length} change{preview.changes.length !== 1 ? 's' : ''}
								</Badge>
							</h3>
							<div class="space-y-1">
								{#each preview.changes as change}
									<div class="text-sm flex items-center gap-2">
										<span class="font-medium">{change.software_name}:</span>
										{#if change.action === 'upgrade'}
											<span class="text-muted-foreground">{change.current_version}</span>
											<span>→</span>
											<span class="text-green-600 font-medium">{change.target_version}</span>
											<Badge variant="secondary" class="text-xs bg-green-100 text-green-800">upgrade</Badge>
										{:else if change.action === 'downgrade'}
											<span class="text-muted-foreground">{change.current_version}</span>
											<span>→</span>
											<span class="text-amber-600 font-medium">{change.target_version}</span>
											<Badge variant="secondary" class="text-xs bg-amber-100 text-amber-800">downgrade</Badge>
										{:else if change.action === 'install'}
											<span class="text-primary font-medium">{change.target_version}</span>
											<Badge variant="secondary" class="text-xs bg-blue-100 text-blue-800">new install</Badge>
										{:else if change.action === 'no_change'}
											<span class="text-muted-foreground">{change.current_version}</span>
											<Badge variant="secondary" class="text-xs bg-gray-100 text-gray-600">already installed</Badge>
										{:else}
											<span class="text-muted-foreground">{change.current_version || 'N/A'}</span>
											<Badge variant="secondary" class="text-xs">{change.action}</Badge>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Action Buttons -->
		<Card class="p-6">
			<div class="flex gap-3">
				<Button
					onclick={handleDeployClick}
					disabled={isDeploying || selectedLpars.length === 0 || !previewData || previewData.length === 0}
				>
					{isDeploying ? 'Deploying...' : 'Deploy Package'}
				</Button>

				<Button variant="ghost" href="/packages/{data.package.id}">Cancel</Button>
			</div>

			<!-- Hidden form for submission -->
			<form
				bind:this={deployFormRef}
				method="POST"
				action="?/deploy"
				use:enhance
				class="hidden"
			>
				<input
					type="hidden"
					name="lpar_ids"
					value={JSON.stringify(selectedLpars.map((l) => l.id))}
				/>
				<input type="hidden" name="deployment_mode" value={deploymentMode} />
				<input type="hidden" name="stop_on_error" value={stopOnError.toString()} />
			</form>
		</Card>
	{/if}

	<!-- Deployment Results -->
	{#if form?.success !== undefined}
		<Card class={`p-6 ${form.success ? 'border-green-500' : 'border-destructive'}`}>
			<h2 class="text-xl font-semibold mb-2">Deployment Results</h2>
			<p class={`mb-4 ${form.success ? 'text-green-600' : 'text-destructive'}`}>
				{form.message}
			</p>

			{#if form.results}
				<div class="space-y-2">
					{#each form.results as result}
						<div class="flex items-center gap-2 text-sm">
							<span class={result.status === 'success' ? 'text-green-600' : 'text-destructive'}>
								{result.status === 'success' ? '✓' : '✗'}
							</span>
							<span>LPAR: {result.lparId}</span>
							{#if result.error}
								<span class="text-destructive">- {result.error}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="mt-4 flex gap-3">
				<Button href="/packages/{data.package.id}">View Package</Button>
				<Button variant="outline" href="/packages">Back to Packages</Button>
			</div>
		</Card>
	{/if}

	<!-- Confirmation Dialog -->
	<ConfirmationDialog
		bind:open={showConfirmation}
		title="Confirm Package Deployment"
		message="You are about to deploy package '{data.package.name} v{data.package.version}' to {summary().total} LPAR{summary().total !== 1 ? 's' : ''}. This will make {summary().changes} version change{summary().changes !== 1 ? 's' : ''} and {summary().newInstalls} new installation{summary().newInstalls !== 1 ? 's' : ''}."
		confirmLabel="Deploy Package"
		variant="destructive"
		onConfirm={handleConfirmDeploy}
		onCancel={handleCancelDeploy}
		details={[
			`Deployment Strategy: ${deploymentMode === 'sequential' ? 'Sequential (one at a time)' : 'Parallel (all at once)'}`,
			`Stop on Error: ${stopOnError ? 'Yes' : 'No'}`,
			'',
			'Affected LPARs:',
			...confirmationDetails()
		]}
	/>

	<!-- Deployment Progress Modal -->
	<DeploymentProgress
		show={isDeploying}
		totalLpars={selectedLpars.length}
		packageName="{data.package.name} v{data.package.version}"
		{deploymentMode}
	/>
</div>
