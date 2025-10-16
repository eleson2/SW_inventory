# Library Organization

This directory contains all shared application code organized by purpose.

## Directory Structure

```
src/lib/
├── components/          # Svelte components
│   ├── common/         # Generic reusable components
│   ├── domain/         # Domain-specific components
│   └── ui/             # Base UI primitives
├── constants/          # Application constants
│   └── validation.ts   # Validation patterns and constraints
├── schemas/            # Zod validation schemas (by domain)
│   ├── customer.ts     # Customer schemas
│   ├── vendor.ts       # Vendor schemas
│   ├── software.ts     # Software schemas
│   ├── package.ts      # Package schemas
│   ├── lpar.ts         # LPAR schemas
│   ├── common.ts       # Shared schemas (pagination, filters)
│   └── index.ts        # Barrel export
├── server/             # Server-side utilities
│   ├── db.ts           # Database connection and helpers
│   ├── route-factory.ts # Generic CRUD route factories
│   ├── page-loader.ts  # Page loader utilities
│   ├── clone-utils.ts  # Entity cloning functionality
│   └── index.ts        # Barrel export
├── services/           # Business logic services
│   └── package-service.ts # Package management logic
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Client/server utility functions
    ├── cn.ts           # Class name utilities
    ├── date-format.ts  # Date formatting
    ├── version-parser.ts # Version parsing and comparison
    ├── clone-handler.ts # Clone dialog handler
    ├── errors.ts       # Error handling utilities
    └── index.ts        # Barrel export
```

## Import Conventions

Use path aliases for cleaner imports:

```typescript
// Constants
import { CODE_PATTERN, FIELD_LENGTHS } from '$lib/constants/validation';

// Schemas
import { customerSchema, vendorSchema } from '$schemas';

// Server utilities
import { db, createDetailLoader, createCreateAction } from '$lib/server';

// Types
import type { Customer, Package, SoftwareVersion } from '$types';

// Utils
import { formatDate, compareVersions, AppError } from '$utils';
```

## Schema Organization

Schemas are organized by domain entity:

- **customer.ts** - Customer validation schemas
- **vendor.ts** - Vendor validation schemas
- **software.ts** - Software and version schemas
- **package.ts** - Package and package item schemas
- **lpar.ts** - LPAR and rollback schemas
- **common.ts** - Shared schemas (pagination, sorting, filters)

Each schema file exports:
- Base schema (e.g., `customerSchema`)
- Update schema (e.g., `customerUpdateSchema`)
- Related schemas if applicable

## Server Utilities

### Route Factories

Generic factories for eliminating CRUD boilerplate:

```typescript
import { createDetailLoader, createCreateAction, createUpdateAction } from '$lib/server';

// Detail page
export const load = createDetailLoader({
  model: db.customers,
  entityName: 'Customer',
  include: { lpars: true }
});

// Create action
export const actions = {
  default: createCreateAction({
    schema: customerSchema,
    model: db.customers,
    entityType: 'customer',
    redirectPath: '/customers',
    extractFormData: (fd) => ({ /* ... */ }),
    checkUnique: async (validated) => { /* ... */ }
  })
};
```

### Database Helpers

```typescript
import { db, getPaginated, softDelete, createAuditLog } from '$lib/server';

// Paginated query
const result = await getPaginated(db.customers, page, pageSize, where, orderBy);

// Soft delete
await softDelete(db.customers, id);

// Audit logging
await createAuditLog('customer', id, 'update', { old, new });
```

## Error Handling

Use custom error classes for consistent error handling:

```typescript
import { NotFoundError, DuplicateError, formatErrorResponse } from '$utils';

// Throw typed errors
if (!customer) throw new NotFoundError('Customer', id);
if (exists) throw new DuplicateError('Customer', 'code', code);

// Format for API response
return json(formatErrorResponse(error), { status: 500 });
```

## Constants

Centralized validation patterns and constraints:

```typescript
import { CODE_PATTERN, FIELD_LENGTHS, ENTITY_TYPES } from '$lib/constants';

// Use in schemas
code: z.string().regex(CODE_PATTERN)
name: z.string().min(FIELD_LENGTHS.name.min).max(FIELD_LENGTHS.name.max)
```

## Best Practices

1. **Use barrel exports** - Import from `$lib/server`, `$schemas`, `$utils` instead of individual files
2. **Keep schemas co-located** - Domain-specific validation stays with the domain
3. **Centralize constants** - Don't hardcode validation patterns or magic numbers
4. **Use error classes** - Throw typed errors instead of generic Error instances
5. **Document complex logic** - Add JSDoc comments for non-obvious functions
6. **Follow naming conventions**:
   - Schemas: `entitySchema`, `entityUpdateSchema`
   - Types: `Entity`, `EntityInput`
   - Functions: `verbEntity` (e.g., `createCustomer`, `getPackages`)
