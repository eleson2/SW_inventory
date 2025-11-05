<script lang="ts">
	import Card from '$components/ui/Card.svelte';
	import Button from '$components/ui/Button.svelte';
	import Badge from '$components/ui/Badge.svelte';
	import VersionDisplay from '$components/domain/VersionDisplay.svelte';
	import { formatDateTime } from '$utils/date-format';

	type SoftwareVersion = {
		id: string;
		version: string;
		ptf_level: string | null;
		release_date: Date;
		release_notes: string | null;
		is_current: boolean;
	};

	let {
		open = $bindable(false),
		softwareName,
		softwareId,
		lparId,
		currentVersion,
		currentPtfLevel,
		versions,
		onRollback
	}: {
		open?: boolean;
		softwareName: string;
		softwareId: string;
		lparId: string;
		currentVersion: string;
		currentPtfLevel?: string;
		versions: SoftwareVersion[];
		onRollback?: () => void;
	} = $props();

	let selectedVersionId = $state<string>('');
	let reasonTemplate = $state<string>('');
	let customReason = $state('');
	let submitting = $state(false);

	// Predefined reason templates
	const reasonTemplates = [
		{ value: 'performance', label: 'Performance Degradation', description: 'Significant performance issues detected' },
		{ value: 'bugs', label: 'Functional Bugs/Errors', description: 'Critical bugs or errors affecting functionality' },
		{ value: 'incompatibility', label: 'Incompatibility Issues', description: 'Compatibility problems with other software' },
		{ value: 'security', label: 'Security Vulnerability', description: 'Security issues discovered' },
		{ value: 'stability', label: 'Stability Issues', description: 'System crashes or instability' },
		{ value: 'other', label: 'Other', description: 'Specify custom reason' }
	];

	// Get the final reason text
	const finalReason = $derived(() => {
		if (reasonTemplate === 'other') {
			return customReason;
		}
		const template = reasonTemplates.find(t => t.value === reasonTemplate);
		return template ? `${template.label}: ${customReason || template.description}` : '';
	});

	// Validation
	const isReasonValid = $derived(() => {
		if (!reasonTemplate) return false;
		if (reasonTemplate === 'other') {
			return customReason.trim().length >= 20;
		}
		return customReason.trim().length >= 10 || finalReason().length >= 10;
	});

	// Filter out the current version and sort by release date
	const availableVersions = $derived(
		versions
			.filter(v =>
				!(v.version === currentVersion && v.ptf_level === currentPtfLevel)
			)
			.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
	);

	const selectedVersion = $derived(
		availableVersions.find(v => v.id === selectedVersionId)
	);

	async function handleSubmit() {
		if (!selectedVersionId || !isReasonValid()) {
			return;
		}

		submitting = true;
		try {
			const formData = new FormData();
			formData.append('software_id', softwareId);
			formData.append('target_version_id', selectedVersionId);
			formData.append('reason', finalReason());

			const response = await fetch(`/lpars/${lparId}?/rollback`, {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				open = false;
				selectedVersionId = '';
				reasonTemplate = '';
				customReason = '';
				if (onRollback) {
					onRollback();
				} else {
					window.location.reload();
				}
			} else {
				const result = await response.json();
				alert(result.message || 'Rollback failed');
			}
		} catch (err) {
			console.error('Error performing rollback:', err);
			alert('Failed to perform rollback');
		} finally {
			submitting = false;
		}
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
		<Card class="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
			<div class="p-6">
				<h2 class="text-2xl font-bold mb-4">Rollback Software</h2>
				<div class="space-y-4">
		<div>
			<h3 class="font-semibold">{softwareName}</h3>
			<p class="text-sm text-muted-foreground">
				Currently installed: <VersionDisplay version={{ version: currentVersion, ptfLevel: currentPtfLevel }} />
			</p>
		</div>

		{#if availableVersions.length === 0}
			<p class="text-sm text-muted-foreground">No previous versions available for rollback.</p>
		{:else}
			<div class="space-y-3">
				<label for="target-version" class="text-sm font-medium">Select version to rollback to:</label>
				<div class="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
					{#each availableVersions as version}
						<button
							type="button"
							class="w-full p-3 text-left border rounded-lg hover:bg-accent transition-colors {selectedVersionId === version.id ? 'bg-accent border-primary' : ''}"
							onclick={() => selectedVersionId = version.id}
						>
							<div class="flex items-center justify-between mb-1">
								<VersionDisplay version={{ version: version.version, ptfLevel: version.ptf_level || undefined }} showBadge={true} />
								{#if version.is_current}
									<Badge variant="secondary">Current Release</Badge>
								{/if}
							</div>
							<p class="text-xs text-muted-foreground">
								Released: {formatDateTime(new Date(version.release_date))}
							</p>
							{#if version.release_notes}
								<p class="text-xs text-muted-foreground mt-1">{version.release_notes}</p>
							{/if}
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-3">
				<div class="text-sm font-medium" role="group" aria-label="Reason for rollback">Reason for rollback *</div>

				<div class="space-y-2">
					{#each reasonTemplates as template}
						<label class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors {reasonTemplate === template.value ? 'border-primary bg-primary/5' : ''}">
							<input
								type="radio"
								bind:group={reasonTemplate}
								value={template.value}
								class="mt-0.5 h-4 w-4"
							/>
							<div class="flex-1">
								<div class="font-medium text-sm">{template.label}</div>
								<div class="text-xs text-muted-foreground">{template.description}</div>
							</div>
						</label>
					{/each}
				</div>

				{#if reasonTemplate}
					<div class="space-y-2">
						<label for="custom-reason" class="text-sm font-medium">
							{#if reasonTemplate === 'other'}
								Detailed explanation *
							{:else}
								Additional details (optional)
							{/if}
						</label>
						<textarea
							id="custom-reason"
							bind:value={customReason}
							placeholder={reasonTemplate === 'other'
								? "Provide a detailed explanation of the issue (minimum 20 characters)"
								: "Add specific details about the issue (e.g., 'CPU usage increased 300% in batch processing')"}
							class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
							required={reasonTemplate === 'other'}
						></textarea>
						<p class="text-xs text-muted-foreground">
							{#if reasonTemplate === 'other'}
								Minimum 20 characters required for custom reasons
							{:else}
								Minimum 10 characters for additional details
							{/if}
						</p>
					</div>
				{/if}

				{#if reasonTemplate && isReasonValid()}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
						<p class="text-xs font-medium text-blue-800">Reason that will be recorded:</p>
						<p class="text-sm text-blue-900 mt-1 font-mono">{finalReason()}</p>
					</div>
				{/if}
			</div>

			{#if selectedVersion}
				<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
					<p class="text-sm font-medium text-yellow-800">Warning</p>
					<p class="text-xs text-yellow-700 mt-1">
						Rolling back from <strong>{currentVersion} {currentPtfLevel || ''}</strong> to
						<strong>{selectedVersion.version} {selectedVersion.ptf_level || ''}</strong> will:
					</p>
					<ul class="text-xs text-yellow-700 mt-2 ml-4 list-disc space-y-1">
						<li>Mark this software as rolled back</li>
						<li>Potentially put the LPAR out of compliance with its assigned package</li>
						<li>Require manual intervention to upgrade again</li>
					</ul>
				</div>
			{/if}
		{/if}
	</div>

				<div class="flex gap-4 pt-4">
					{#if availableVersions.length > 0}
						<Button
							variant="destructive"
							onclick={handleSubmit}
							disabled={!selectedVersionId || !isReasonValid() || submitting}
						>
							{submitting ? 'Rolling back...' : 'Confirm Rollback'}
						</Button>
					{/if}
					<Button variant="outline" onclick={() => open = false} disabled={submitting}>
						Cancel
					</Button>
				</div>
			</div>
	</Card>
</div>
{/if}
