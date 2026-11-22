<script lang="ts">
	import { Button, Card, Badge } from '#lib/components/ui/index.ts';

	let fileInput: HTMLInputElement;
	let selectedFile: File | null = null;
	let importingType: string | null = null;
	let results: Record<
		string,
		{ success: boolean; message: string; counts?: any; skippedProducts?: string[]; errors?: string[] }
	> = {};

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
		}
	}

	async function handleImport(type: string) {
		if (!selectedFile) {
			alert('Please select a file first');
			return;
		}

		importingType = type;

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);
			formData.append('type', type);

			const response = await fetch('/api/import', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			results[type] = result;

			if (!result.success) {
				alert(`Import failed: ${result.message}`);
			}
		} catch (error: any) {
			results[type] = {
				success: false,
				message: error.message || 'Import failed'
			};
			alert(`Import error: ${error.message}`);
		} finally {
			importingType = null;
		}
	}

	function getStepBadgeVariant(step: number): 'default' | 'secondary' | 'outline' {
		return 'default';
	}

	function isImporting(type: string): boolean {
		return importingType === type;
	}

	function getResultEmoji(type: string): string {
		if (!results[type]) return '';
		return results[type].success ? '✓' : '✗';
	}

	function getResultClass(type: string): string {
		if (!results[type]) return '';
		return results[type].success ? 'text-green-600' : 'text-red-600';
	}
</script>

<div class="container mx-auto max-w-4xl space-y-6 p-6">
	<div>
		<h1 class="text-3xl font-bold">Import Data</h1>
		<p class="mt-2 text-muted-foreground">
			Import data from SW Master.ods file. Follow the steps in order.
		</p>
	</div>

	<!-- File Selection -->
	<Card class="p-6">
		<div class="space-y-4">
			<div>
				<h2 class="text-lg font-semibold">Select File</h2>
				<p class="text-sm text-muted-foreground">Choose the SW Master.ods file to import</p>
			</div>

			<div class="flex items-center gap-4">
				<input
					bind:this={fileInput}
					type="file"
					accept=".ods,.xlsx,.xls,.csv"
					on:change={handleFileSelect}
					class="hidden"
					id="file-upload"
				/>
				<Button
					variant="outline"
					onclick={() => fileInput?.click()}
					class="flex items-center gap-2"
				>
					📁 Choose File
				</Button>
				{#if selectedFile}
					<span class="text-sm text-muted-foreground">{selectedFile.name}</span>
				{:else}
					<span class="text-sm text-muted-foreground">No file selected</span>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Import Instructions -->
	<Card class="border-blue-200 bg-blue-50 p-6">
		<h3 class="mb-2 font-semibold text-blue-900">Import Order</h3>
		<p class="text-sm text-blue-800">
			You must import data in the following order. Each step depends on the previous ones:
		</p>
		<ol class="mt-3 space-y-1 text-sm text-blue-800">
			<li>1. Vendors (software manufacturers)</li>
			<li>2. Customers (organizations that own LPARs)</li>
			<li>3. Products (software from vendors)</li>
			<li>4. LPARs (includes LPAR creation and software assignments)</li>
		</ol>
	</Card>

	<!-- Import Actions -->
	<div class="space-y-4">
		<h2 class="text-lg font-semibold">Import Steps</h2>

		<!-- Step 1: Vendors -->
		<Card class="p-6">
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-2">
					<div class="flex items-center gap-2">
						<Badge variant={getStepBadgeVariant(1)}>Step 1</Badge>
						<h3 class="text-lg font-semibold">Import Vendors</h3>
					</div>
					<p class="text-sm text-muted-foreground">
						Import software vendors/manufacturers (e.g., IBM, Broadcom)
					</p>
					{#if results.vendors}
						<div class="flex items-center gap-2 {getResultClass('vendors')}">
							<span class="text-lg">{getResultEmoji('vendors')}</span>
							<span class="text-sm">{results.vendors.message}</span>
							{#if results.vendors.counts}
								<span class="text-sm">
									(Created: {results.vendors.counts.created}, Updated: {results.vendors.counts
										.updated})
								</span>
							{/if}
						</div>
					{/if}
				</div>
				<Button
					onclick={() => handleImport('vendors')}
					disabled={!selectedFile || isImporting('vendors') || importingType !== null}
				>
					{#if isImporting('vendors')}
						⏳ Importing...
					{:else}
						Import Vendors
					{/if}
				</Button>
			</div>
		</Card>

		<!-- Step 2: Customers -->
		<Card class="p-6">
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-2">
					<div class="flex items-center gap-2">
						<Badge variant={getStepBadgeVariant(2)}>Step 2</Badge>
						<h3 class="text-lg font-semibold">Import Customers</h3>
					</div>
					<p class="text-sm text-muted-foreground">
						Import customer organizations that own LPARs
					</p>
					{#if results.customers}
						<div class="flex items-center gap-2 {getResultClass('customers')}">
							<span class="text-lg">{getResultEmoji('customers')}</span>
							<span class="text-sm">{results.customers.message}</span>
							{#if results.customers.counts}
								<span class="text-sm">
									(Created: {results.customers.counts.created}, Updated: {results.customers.counts
										.updated})
								</span>
							{/if}
						</div>
					{/if}
				</div>
				<Button
					onclick={() => handleImport('customers')}
					disabled={!selectedFile || isImporting('customers') || importingType !== null}
				>
					{#if isImporting('customers')}
						⏳ Importing...
					{:else}
						Import Customers
					{/if}
				</Button>
			</div>
		</Card>

		<!-- Step 3: Products -->
		<Card class="p-6">
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-2">
					<div class="flex items-center gap-2">
						<Badge variant={getStepBadgeVariant(3)}>Step 3</Badge>
						<h3 class="text-lg font-semibold">Import Products</h3>
					</div>
					<p class="text-sm text-muted-foreground">
						Import software products and their versions (requires vendors)
					</p>
					{#if results.products}
						<div class="flex items-center gap-2 {getResultClass('products')}">
							<span class="text-lg">{getResultEmoji('products')}</span>
							<span class="text-sm">{results.products.message}</span>
							{#if results.products.counts}
								<span class="text-sm">
									(Created: {results.products.counts.created}, Updated: {results.products.counts
										.updated}, Skipped: {results.products.counts.skipped})
								</span>
							{/if}
						</div>
					{/if}
				</div>
				<Button
					onclick={() => handleImport('products')}
					disabled={!selectedFile || isImporting('products') || importingType !== null}
				>
					{#if isImporting('products')}
						⏳ Importing...
					{:else}
						Import Products
					{/if}
				</Button>
			</div>
		</Card>

		<!-- Step 4: LPARs -->
		<Card class="p-6">
			<div class="flex items-start justify-between">
				<div class="flex-1 space-y-2">
					<div class="flex items-center gap-2">
						<Badge variant={getStepBadgeVariant(4)}>Step 4</Badge>
						<h3 class="text-lg font-semibold">Import LPARs</h3>
					</div>
					<p class="text-sm text-muted-foreground">
						Import LPARs and their software assignments (requires customers and products)
					</p>
					{#if results.lpars}
						<div class="flex items-center gap-2 {getResultClass('lpars')}">
							<span class="text-lg">{getResultEmoji('lpars')}</span>
							<span class="text-sm">{results.lpars.message}</span>
							{#if results.lpars.counts}
								<span class="text-sm">
									(Created: {results.lpars.counts.created}, Updated: {results.lpars.counts.updated})
								</span>
							{/if}
						</div>
					{/if}
				</div>
				<Button
					onclick={() => handleImport('lpars')}
					disabled={!selectedFile || isImporting('lpars') || importingType !== null}
				>
					{#if isImporting('lpars')}
						⏳ Importing...
					{:else}
						Import LPARs
					{/if}
				</Button>
			</div>
		</Card>
	</div>

	<!-- Vendor bundles (separate from the SW Master steps) -->
	<div class="space-y-4">
		<h2 class="text-lg font-semibold">Vendor Bundles</h2>
		<Card class="p-6">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1 space-y-2">
					<h3 class="text-lg font-semibold">Import Vendor Bundle CSV</h3>
					<p class="text-sm text-muted-foreground">
						Broadcom CARS / IBM RSU levels, e.g. produced by <code>npm run bundles:fetch</code>. Columns:
						<code class="text-xs">vendor_code, bundle_code, bundle_name, bundle_type, release_date, product_code,
						product_name, version, ptf_level, notes</code>. Products are matched on the software's vendor
						product code, then on name; unknown products are skipped. Re-importing a bundle replaces its items.
					</p>
					{#if results.bundles}
						<div class="space-y-1 {getResultClass('bundles')}">
							<div class="flex items-center gap-2">
								<span class="text-lg">{getResultEmoji('bundles')}</span>
								<span class="text-sm">{results.bundles.message}</span>
							</div>
							{#if results.bundles.errors?.length}
								<ul class="list-disc pl-6 text-sm text-red-600">
									{#each results.bundles.errors as err}<li>{err}</li>{/each}
								</ul>
							{/if}
							{#if results.bundles.skippedProducts?.length}
								<details class="text-sm text-muted-foreground">
									<summary class="cursor-pointer">
										{results.bundles.skippedProducts.length} product(s) not in the inventory, skipped
									</summary>
									<ul class="mt-1 max-h-48 overflow-y-auto pl-6 list-disc">
										{#each results.bundles.skippedProducts as product}<li>{product}</li>{/each}
									</ul>
								</details>
							{/if}
						</div>
					{/if}
				</div>
				<Button
					onclick={() => handleImport('bundles')}
					disabled={!selectedFile || isImporting('bundles') || importingType !== null}
				>
					{#if isImporting('bundles')}
						⏳ Importing...
					{:else}
						Import Bundles
					{/if}
				</Button>
			</div>
		</Card>
	</div>
</div>
