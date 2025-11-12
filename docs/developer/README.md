# Developer Guide

This guide provides detailed information for developers working on the Software Inventory Management System.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Development Workflow](#development-workflow)
3. [Code Architecture](#code-architecture)
4. [Common Tasks](#common-tasks)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Environment Setup

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (local or remote)
- **Git** for version control
- **VS Code** (recommended editor)

### Initial Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd SW_inventory
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/sw_inventory"
NODE_ENV="development"
```

4. **Set up the database**
```bash
# Create database (if needed)
createdb sw_inventory

# Push Prisma schema to database
npx prisma db push

# Seed with test data
npx tsx prisma/scripts/run-sql.ts reset-and-load
```

5. **Start development server**
```bash
npm run dev
```

Visit `http://localhost:5173` to see the application.

## Development Workflow

### File-Based Routing

SvelteKit uses file-based routing. Each folder in `src/routes/` becomes a URL path:

```
src/routes/
├── +page.svelte              →  /
├── vendors/
│   ├── +page.svelte          →  /vendors
│   ├── +page.server.ts       →  Server-side data loading for /vendors
│   ├── new/
│   │   ├── +page.svelte      →  /vendors/new
│   │   └── +page.server.ts   →  Server-side for /vendors/new
│   └── [id]/
│       ├── +page.svelte      →  /vendors/:id
│       ├── +page.server.ts   →  Server-side for /vendors/:id
│       └── edit/
│           ├── +page.svelte  →  /vendors/:id/edit
│           └── +page.server.ts
```

### Server vs Client Code

**Server-side** (`+page.server.ts`, `+server.ts`):
- Database queries
- Form action handlers
- Authentication checks
- Sensitive operations

**Client-side** (`+page.svelte`, components):
- UI rendering
- User interactions
- Client-side navigation
- Form submission (enhanced with JavaScript)

### Svelte 5 Runes

The project uses Svelte 5's new runes system:

```svelte
<script lang="ts">
  // Props (instead of export let)
  let { data, formData } = $props();

  // State (instead of let with $: reactivity)
  let count = $state(0);

  // Derived values (instead of $: statements)
  let doubled = $derived(count * 2);

  // Effects (instead of $: with side effects)
  $effect(() => {
    console.log(`Count is ${count}`);
  });
</script>
```

## Code Architecture

### Reusable Patterns

#### 1. Generic Page Loader

For listing pages with pagination, sorting, and filtering:

```typescript
// src/routes/vendors/+page.server.ts
import { createPageLoader } from '$lib/server/page-loader';
import { createStatusFilter } from '$lib/server/filter-builders';

export const load: PageServerLoad = async ({ url }) => {
  return createPageLoader({
    model: db.vendors,
    dataKey: 'vendors',
    filterBuilder: createStatusFilter
  })(url);
};
```

#### 2. Generic Form Actions

For create/update operations:

```typescript
// src/routes/vendors/new/+page.server.ts
import { createFormAction } from '$lib/server/form-actions';

export const actions: Actions = {
  default: createFormAction({
    schema: vendorSchema,
    model: db.vendors,
    entityType: 'vendor',
    redirectPath: (id) => `/vendors/${id}`,
    transform: (data) => ({
      name: data.name,
      code: data.code,
      website: data.website || null,
      contact_email: data.contact_email || null,
      active: data.active
    })
  })
};
```

#### 3. Form Validation with Superforms

```typescript
// In +page.svelte
import { typedSuperForm } from '$lib/utils/superforms';
import { vendorSchema } from '$lib/schemas/vendor';

const { form, errors, enhance, submitting } = typedSuperForm(
  data.form,
  vendorSchema,
  {
    dataType: 'json',
    resetForm: false,
    onResult: ({ result }) => {
      if (result.type === 'redirect') {
        goto(result.location);
      }
    }
  }
);
```

#### 4. Master-Detail Forms

For complex forms with parent-child relationships (e.g., package with items):

```typescript
import { useMasterDetailForm } from '$lib/utils/useMasterDetailForm.svelte';

const { handleSubmit, submitting } = useMasterDetailForm({
  onBuildFormData: (formData) => {
    formData.set('items', JSON.stringify(items));
  }
});
```

### Component Patterns

#### Snippets (Svelte 5)

For flexible component composition:

```svelte
<PageHeader title="Vendors" description="Manage vendors">
  {#snippet actions()}
    <Button onclick={() => goto('/vendors/new')}>Add Vendor</Button>
  {/snippet}
</PageHeader>
```

#### Generics in Components

For type-safe reusable components:

```svelte
<script lang="ts" generics="T">
  let {
    data,
    columns,
    onRowClick
  }: {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
  } = $props();
</script>
```

## Common Tasks

### Adding a New Entity

1. **Update Prisma Schema**

```prisma
// prisma/schema.prisma
model MyEntity {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String
  code        String   @unique
  active      Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
}
```

2. **Create Migration**

```bash
npx prisma migrate dev --name add_my_entity
npx prisma generate
```

3. **Create Zod Schema**

```typescript
// src/lib/schemas/my-entity.ts
import { z } from 'zod';
import { CODE_PATTERN, CODE_ERROR_MESSAGE, FIELD_LENGTHS } from '$lib/constants/validation';

const baseFields = {
  name: z.string().min(2).max(255),
  code: z.string().regex(CODE_PATTERN, CODE_ERROR_MESSAGE)
};

export const myEntitySchema = z.object({
  ...baseFields,
  active: z.boolean().default(true)
});

export const myEntityUpdateSchema = z.object({
  ...baseFields,
  active: z.boolean().optional()
});
```

4. **Add TypeScript Types**

```typescript
// src/lib/types/index.ts
export interface MyEntity {
  id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

5. **Create CRUD Routes**

Create the following files:
- `src/routes/my-entities/+page.svelte` - List view
- `src/routes/my-entities/+page.server.ts` - List data loader
- `src/routes/my-entities/new/+page.svelte` - Create form
- `src/routes/my-entities/new/+page.server.ts` - Create action
- `src/routes/my-entities/[id]/+page.svelte` - Detail view
- `src/routes/my-entities/[id]/+page.server.ts` - Detail loader
- `src/routes/my-entities/[id]/edit/+page.svelte` - Edit form
- `src/routes/my-entities/[id]/edit/+page.server.ts` - Edit action

6. **Add to Navigation**

```svelte
<!-- src/routes/+layout.svelte -->
<nav>
  <!-- ... existing nav items -->
  <a href="/my-entities">My Entities</a>
</nav>
```

### Working with Database

#### Query Examples

```typescript
// Get all with filtering
const entities = await db.myEntity.findMany({
  where: {
    active: true,
    name: { contains: searchTerm, mode: 'insensitive' }
  },
  orderBy: { name: 'asc' },
  take: 20,
  skip: (page - 1) * 20
});

// Get one with relations
const entity = await db.myEntity.findUnique({
  where: { id },
  include: { relatedEntities: true }
});

// Create with audit log
const entity = await db.myEntity.create({
  data: { name, code, active: true }
});
await createAuditLog('my_entity', entity.id, 'create', entity);

// Update with audit log
const oldEntity = await db.myEntity.findUnique({ where: { id } });
const entity = await db.myEntity.update({
  where: { id },
  data: { name, code }
});
await createAuditLog('my_entity', id, 'update', entity, oldEntity);

// Soft delete
await db.myEntity.update({
  where: { id },
  data: { active: false, deleted_at: new Date() }
});
```

#### Transaction Example

```typescript
await db.$transaction(async (tx) => {
  // Create parent
  const parent = await tx.parent.create({ data: {...} });

  // Create children
  await tx.child.createMany({
    data: items.map(item => ({
      parent_id: parent.id,
      ...item
    }))
  });

  // Audit log
  await tx.auditLog.create({
    data: {
      entity_type: 'parent',
      entity_id: parent.id,
      action: 'create',
      changes: parent
    }
  });
});
```

### Adding a New Component

1. **Determine component type**:
   - **UI**: Base components (Button, Card, etc.) → `src/lib/components/ui/`
   - **Common**: Reusable (DataTable, Forms, etc.) → `src/lib/components/common/`
   - **Domain**: Business-specific → `src/lib/components/domain/`

2. **Create component file**:

```svelte
<!-- src/lib/components/common/MyComponent.svelte -->
<script lang="ts">
  import { cn } from '$utils/cn';

  let {
    value,
    onChange,
    class: className
  }: {
    value: string;
    onChange: (value: string) => void;
    class?: string;
  } = $props();

  // Component logic here
</script>

<div class={cn("base-styles", className)}>
  <!-- Component markup -->
</div>
```

3. **Use the component**:

```svelte
<script>
  import MyComponent from '$components/common/MyComponent.svelte';
</script>

<MyComponent
  value={someValue}
  onChange={(val) => someValue = val}
  class="additional-styles"
/>
```

## Testing

### Manual Testing

1. **Test data setup**:
```bash
npx tsx prisma/scripts/run-sql.ts reset-and-load
```

2. **Test scenarios**:
- Create entity
- Edit entity
- Delete (soft delete)
- Search/filter
- Sort
- Pagination
- Form validation (client & server)
- Error handling

3. **Browser testing**:
- Chrome (primary)
- Firefox
- Safari
- Mobile browsers (responsive design)

### Database Testing

```typescript
// Test script example
import { db } from './src/lib/server/db';

async function test() {
  const vendor = await db.vendors.findFirst({
    where: { code: 'IBM' }
  });
  console.log(vendor);
}

test();
```

## Troubleshooting

### Common Issues

#### 1. Prisma Client Out of Sync

**Error**: Type errors after schema changes

**Solution**:
```bash
npx prisma generate
npm run dev
```

#### 2. Database Connection Issues

**Error**: Can't connect to database

**Solution**:
- Check DATABASE_URL in `.env`
- Verify PostgreSQL is running
- Test connection: `psql -U username -d sw_inventory`

#### 3. Port Already in Use

**Error**: Port 5173 is already in use

**Solution**:
```bash
# Find process using port
netstat -ano | findstr :5173

# Kill process
taskkill /PID <pid> /F

# Or use different port
npm run dev -- --port 3000
```

#### 4. Form Not Submitting

**Checklist**:
- Check form has `method="POST"`
- Verify `use:enhance` is added
- Check server action exists in `+page.server.ts`
- Look for validation errors in browser console
- Check network tab for failed requests

#### 5. Type Errors in VS Code

**Solution**:
1. Restart TypeScript server: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
2. Clear `.svelte-kit` folder and restart dev server
3. Run `npm run check` to see actual errors

### Debugging Tips

**Server-side**:
```typescript
console.log('Debug:', data);  // Shows in terminal
```

**Client-side**:
```typescript
console.log('Debug:', data);  // Shows in browser console
```

**Network debugging**:
- Open browser DevTools (F12)
- Network tab shows all requests
- Check request/response payloads

## Best Practices

### Code Style

1. **Use TypeScript** for type safety
2. **Follow Svelte 5 patterns** (runes, snippets)
3. **Extract reusable logic** into utilities
4. **Keep components small** and focused
5. **Use path aliases** (`$lib`, `$components`, etc.)

### Performance

1. **Server-side pagination** for large datasets
2. **Lazy load** images and heavy components
3. **Debounce** search inputs (400ms default)
4. **Minimize database queries** - use includes carefully
5. **Index** frequently queried columns

### Security

1. **Validate on server** (never trust client)
2. **Use Zod schemas** for validation
3. **Sanitize user input** before database operations
4. **Log all changes** via audit_log
5. **Use soft deletes** to prevent data loss

### Accessibility

1. **Semantic HTML** (proper heading hierarchy)
2. **Keyboard navigation** (test with Tab key)
3. **Screen reader support** (ARIA labels)
4. **Color contrast** (WCAG AA minimum)
5. **Form labels** and error messages

### Git Workflow

1. **Create feature branch**: `git checkout -b feature/my-feature`
2. **Make small, focused commits**
3. **Write descriptive commit messages**
4. **Test before committing**
5. **Create pull request** for review
6. **Merge to main** after approval

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] No console.log statements in production code
- [ ] Error handling is present
- [ ] Form validation works (client & server)
- [ ] Database queries are efficient
- [ ] Audit logging is implemented
- [ ] Components are reusable where appropriate
- [ ] TypeScript types are correct
- [ ] No hardcoded values (use constants)
- [ ] Responsive design works on mobile

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build               # Build for production
npm run preview             # Preview production build
npm run check               # Type-check

# Database
npx prisma studio           # Open Prisma Studio (GUI)
npx prisma generate         # Generate Prisma client
npx prisma db push          # Push schema to database
npx prisma migrate dev      # Create migration
npx prisma migrate deploy   # Run migrations in production

# Data management
npx tsx prisma/scripts/run-sql.ts reset          # Clear all data
npx tsx prisma/scripts/run-sql.ts test-data     # Load test data
npx tsx prisma/scripts/run-sql.ts reset-and-load  # Reset + load

# Git
git status                  # Check status
git add .                   # Stage all changes
git commit -m "message"     # Commit
git push                    # Push to remote
git pull                    # Pull from remote
```

## Additional Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Svelte 5 Documentation](https://svelte.dev/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Superforms Documentation](https://superforms.rocks/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
