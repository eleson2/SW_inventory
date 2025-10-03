import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✓ Created: ${filePath}`);
}

console.log('🚀 Part 1: Generating Schemas, Server, and Core Components...\n');

// =============================================================================
// SCHEMAS
// =============================================================================

writeFile('src/lib/schemas/vendor.ts', `import { z } from 'zod';

export const vendorSchema = z.object({
  vendor_id: z.number().optional(),
  vendor_name: z.string().min(1, 'Vendor name is required').max(255),
  vendor_code: z.string().max(50).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  notes: z.string().max(5000).optional()
});

export type VendorSchema = typeof vendorSchema;
`);

writeFile('src/lib/schemas/customer.ts', `import { z } from 'zod';

export const customerSchema = z.object({
  customer_id: z.number().optional(),
  customer_name: z.string().min(1, 'Customer name is required').max(255),
  customer_code: z.string().max(50).optional(),
  contact_email: z.string().email().max(255).optional().or(z.literal('')),
  contact_phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional()
});

export type CustomerSchema = typeof customerSchema;
`);

writeFile('src/lib/schemas/product.ts', `import { z } from 'zod';

export const productSchema = z.object({
  product_id: z.number().optional(),
  vendor_id: z.number({ required_error: 'Vendor is required' }),
  product_name: z.string().min(1, 'Product name is required').max(255),
  product_code: z.string().max(50).optional(),
  description: z.string().max(5000).optional()
});

export type ProductSchema = typeof productSchema;
`);

writeFile('src/lib/schemas/suite.ts', `import { z } from 'zod';

export const suiteSchema = z.object({
  suite_id: z.number().optional(),
  suite_name: z.string().min(1, 'Suite name is required').max(255),
  suite_version: z.string().min(1, 'Suite version is required').max(50),
  description: z.string().max(5000).optional(),
  vendor_id: z.number().optional()
});

export type SuiteSchema = typeof suiteSchema;
`);

writeFile('src/lib/schemas/version.ts', `import { z } from 'zod';

export const versionSchema = z.object({
  version_id: z.number().optional(),
  product_id: z.number({ required_error: 'Product is required' }),
  version_string: z.string().min(1, 'Version string is required').max(100),
  version_major: z.number({ required_error: 'Major version is required' }),
  version_minor: z.number().optional(),
  version_patch: z.number().optional(),
  release_date: z.string().optional(),
  notes: z.string().max(5000).optional()
});

export type VersionSchema = typeof versionSchema;
`);

writeFile('src/lib/schemas/lpar.ts', `import { z } from 'zod';

export const lparSchema = z.object({
  lpar_id: z.number().optional(),
  customer_id: z.number({ required_error: 'Customer is required' }),
  lpar_name: z.string().min(1, 'LPAR name is required').max(255),
  lpar_code: z.string().max(50).optional(),
  hostname: z.string().max(255).optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(5000).optional()
});

export type LparSchema = typeof lparSchema;
`);

writeFile('src/lib/schemas/package.ts', `import { z } from 'zod';

export const packageSchema = z.object({
  package_id: z.number().optional(),
  package_name: z.string().min(1, 'Package name is required').max(255),
  package_version: z.string().min(1, 'Package version is required').max(50),
  build_date: z.string().min(1, 'Build date is required'),
  description: z.string().max(5000).optional()
});

export type PackageSchema = typeof packageSchema;
`);

// =============================================================================
// SERVER
// =============================================================================

writeFile('src/lib/server/db.ts', `// Database connection placeholder
// TODO: Replace this with your actual PostgreSQL connection

export const db = {
  query: async (text: string, params?: any[]) => {
    // Example with pg library:
    // import pkg from 'pg';
    // const { Pool } = pkg;
    // const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // const result = await pool.query(text, params);
    // return result;
    
    console.warn('⚠️  Database not configured - using placeholder');
    console.log('Query:', text);
    console.log('Params:', params);
    
    return { rows: [] };
  }
};
`);

// =============================================================================
// ENTITY COMPONENTS
// =============================================================================

writeFile('src/lib/components/entity/EntityDialog.svelte', `<script lang="ts" generics="T extends Record<string, any>">
  import { superForm } from 'sveltekit-superforms/client';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import type { SuperValidated } from 'sveltekit-superforms';
  import type { ZodSchema } from 'zod';
  
  type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item?: T | null;
    data: { form: SuperValidated<T> };
    schema: ZodSchema;
    entityName: string;
    description?: string;
    action?: string;
    onSuccess?: () => void;
    isClone?: boolean;
    cloneNotice?: string;
    maxWidth?: string;
    children: any;
  };
  
  let { 
    open = $bindable(),
    onOpenChange,
    item = null,
    data,
    schema,
    entityName,
    description = '',
    action,
    onSuccess,
    isClone = false,
    cloneNotice = '',
    maxWidth = 'sm:max-w-[600px]',
    children
  }: Props = $props();
  
  const isEdit = $derived(!!item && !isClone);
  const computedAction = $derived(action || (isEdit ? '?/update' : '?/create'));
  const title = $derived(
    isClone ? \`Clone \${entityName}\` : (isEdit ? \`Edit \${entityName}\` : \`Create New \${entityName}\`)
  );
  
  const form = superForm(data.form, {
    validators: zodClient(schema),
    resetForm: true,
    onUpdated: ({ form }) => {
      if (form.valid && form.message) {
        if (form.message.includes('successfully')) {
          toast.success(form.message);
          open = false;
          if (onSuccess) onSuccess();
        } else {
          toast.error(form.message);
        }
      }
    }
  });
  
  const { enhance, delayed } = form;
  
  function handleOpenChange(newOpen: boolean) {
    if (!newOpen && !$delayed) {
      form.reset();
    }
    onOpenChange(newOpen);
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="{maxWidth} max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
      {#if isClone && cloneNotice}
        <div class="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm text-blue-900 dark:text-blue-100">
          ℹ️ {cloneNotice}
        </div>
      {/if}
    </Dialog.Header>
    
    <form method="POST" action={computedAction} use:enhance class="space-y-4">
      {@render children({ form, isEdit, item, delayed: $delayed })}
      
      <Dialog.Footer>
        <Button 
          type="button" 
          variant="outline" 
          onclick={() => open = false} 
          disabled={$delayed}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={$delayed}>
          {$delayed ? 'Saving...' : (isEdit ? \`Update \${entityName}\` : \`Create \${entityName}\`)}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
`);

writeFile('src/lib/components/entity/DeleteDialog.svelte', `<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Button } from '$lib/components/ui/button';
  import { toast } from 'svelte-sonner';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  
  type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: any[];
    entityName: string;
    entityNamePlural?: string;
    action?: string;
    idField?: string;
    nameFormatter?: (item: any) => string;
    warningMessage?: string;
    warningContent?: any;
    onSuccess?: () => void;
  };
  
  let { 
    open = $bindable(),
    onOpenChange,
    items,
    entityName,
    entityNamePlural,
    action = '?/delete',
    idField,
    nameFormatter,
    warningMessage,
    warningContent,
    onSuccess
  }: Props = $props();
  
  let isDeleting = $state(false);
  
  const plural = $derived(entityNamePlural || \`\${entityName}s\`);
  const computedIdField = $derived(idField || \`\${entityName.toLowerCase()}_id\`);
  const ids = $derived(items.map(item => item[computedIdField]));
  const names = $derived(
    items.map(item => 
      nameFormatter 
        ? nameFormatter(item) 
        : (item[\`\${entityName.toLowerCase()}_name\`] || item.name || 'Unknown')
    ).join(', ')
  );
</script>

<AlertDialog.Root {open} onOpenChange={onOpenChange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        Delete {items.length} {items.length === 1 ? entityName : plural}?
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-2">
        {#if warningMessage}
          <p class="text-destructive font-medium">⚠️ {warningMessage}</p>
        {/if}
        
        {#if warningContent}
          {@render warningContent()}
        {/if}
        
        <p>
          Are you sure you want to delete the following {items.length === 1 ? entityName.toLowerCase() : plural.toLowerCase()}?
        </p>
        <p class="font-medium">{names}</p>
        <p class="text-sm text-muted-foreground">
          This action cannot be undone.
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
      <form 
        method="POST" 
        {action}
        use:enhance={() => {
          isDeleting = true;
          return async ({ result }) => {
            isDeleting = false;
            await applyAction(result);
            
            if (result.type === 'success') {
              toast.success(result.data?.message || \`\${plural} deleted successfully\`);
              open = false;
              if (onSuccess) onSuccess();
              await invalidateAll();
            } else if (result.type === 'failure') {
              toast.error(result.data?.message || \`Failed to delete \${plural.toLowerCase()}\`);
            }
          };
        }}
      >
        <input type="hidden" name={\`\${computedIdField}s\`} value={JSON.stringify(ids)} />
        <Button type="submit" variant="destructive" disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
      </form>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
`);

console.log('\n✅ Part 1 Complete!');
console.log('   - 7 schema files');
console.log('   - Database connection file');
console.log('   - 2 entity component files\n');
console.log('📝 Next: Run generate-app-part2.mjs for EntityTable and Form components\n');
