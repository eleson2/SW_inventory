# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Software Inventory Management System for tracking mainframe software in a multi-tenant environment. Built with SvelteKit, TypeScript, Prisma, and PostgreSQL.

## Development Commands

### Setup & Database
```bash
npm install                                        # Install dependencies
npx prisma generate                               # Generate Prisma client
npx prisma db push                                # Push schema to database

# Data Management - Choose one approach:

# Option A: TypeScript seed script
npx prisma db seed                                # Seed via TypeScript (seed.ts)

# Option B: SQL scripts (recommended for production-like workflows)
npx tsx prisma/scripts/run-sql.ts reset           # Empty all tables
npx tsx prisma/scripts/run-sql.ts test-data       # Load test data
npx tsx prisma/scripts/run-sql.ts reset-and-load  # Reset + load (full refresh)

# Database Tools
npx prisma studio                                 # Open Prisma Studio on http://localhost:5556
```

### Development
```bash
npm run dev                   # Start dev server on http://localhost:5173
npm run build                 # Build for production
npm run preview               # Preview production build
npm run check                 # Type-check without watching
npm run check:watch           # Type-check with watch mode
```

### Database Connection
Set `DATABASE_URL` environment variable to PostgreSQL connection string. The application uses Prisma with PostgreSQL.

## Architecture

### Data Model Hierarchy

The system follows this entity relationship:
- **Vendors** → create **Software** products
- **Software** → has multiple **Software Versions** (normalized table)
- **Software Versions** → referenced by **Package Items**
- **Packages** → contain **Package Items** → assigned to **LPARs**
- **Customers** → own **LPARs**
- **LPARs** → track installed **Software** with version history via **lpar_software**

**Key Tables**:
- `software_versions`: Normalized version history (replaces JSON `version_history`)
- `package_items`: Links packages to specific software versions
- `lpar_software`: Current and previous versions installed on each LPAR

### Version Management

**Critical**: Software versions are now **normalized** in the `software_versions` table:
- Version format: `V5R6M0` or `2.4.0`
- PTF levels: `PTF12345` or `SO12345` (vendor-specific)
- Each version is a separate row with release dates, support info, and release notes
- `software.current_version_id` points to the active version
- `is_current` flag marks the current version for each software product

The `version-parser.ts` utility provides:
- `parseVendorDesignation()`: Extract version and PTF from vendor strings
- `compareVersions()`, `comparePtfLevels()`: Version comparison logic
- `isVersionCompatible()`: Check if installed version meets requirements

**When working with versions**:
- Create new rows in `software_versions` table, not JSON arrays
- Query version history via `software.versions` relation
- Reference specific versions in packages via `software_version_id`
- Update `software.current_version_id` when releasing new versions
- PTF levels are vendor-specific (IBM uses PTF, Broadcom uses SO)

### Database Layer

**Location**: `src/lib/server/db.ts`

Prisma singleton pattern with helper functions:
- `db`: PrismaClient instance (reused in dev to prevent connection exhaustion)
- `getPaginated()`: Generic pagination for any model
- `softDelete()`: Sets `active: false` instead of deleting
- `createAuditLog()`: Logs entity changes

**In +page.server.ts files**:
```typescript
import { db } from '$lib/server/db';
// Use db.vendors, db.software, db.packages, db.lpars, etc.
```

### Server Load Functions

All routes use SvelteKit's `+page.server.ts` pattern:
- `load()`: Fetch data from Prisma
- Include relations needed for display (e.g., `include: { vendors: true }`)
- Handle pagination, filtering, sorting
- Use `error()` for 404s

### Form Validation

Uses Superforms with Zod schemas from `src/lib/schemas/index.ts`:
- Schemas mirror Prisma models with validation rules
- Codes must be `UPPERCASE_WITH_UNDERSCORES_OR_DASHES`
- Nested objects use `softwareVersionSchema` for version/PTF pairs
- Forms use `superValidate()` in `load()` and form actions

### Component Organization

**Base UI** (`src/lib/components/ui/`):
- Primitive components (Button, Card, Input, Badge)
- Based on shadcn design patterns
- Styled with Tailwind CSS

**Common** (`src/lib/components/common/`):
- `DataTable.svelte`: Generic table with sorting, pagination (uses Svelte 5 generics)
- `Pagination.svelte`: Pagination controls
- `FormField.svelte`: Form field with validation errors

**Domain** (`src/lib/components/domain/`):
- `VersionDisplay.svelte`: Display version with PTF level formatting

### Path Aliases

Configured in `svelte.config.js`:
```typescript
$lib          → src/lib
$components   → src/lib/components
$types        → src/lib/types
$utils        → src/lib/utils
$stores       → src/lib/stores
$schemas      → src/lib/schemas
```

## Mainframe Concepts

### Packages
Coordinated software releases containing multiple products tested together:
- Include ALL software the service provider manages
- Each item has specific version and PTF level
- `order_index` determines installation order

### LPARs (Logical Partitions)
Customer environments that run software:
- Each LPAR belongs to one customer
- Assigned to a specific package version
- Tracks currently installed software with version history
- Can have different versions than assigned package (due to rollbacks)

### Rollback Support
Individual software can be rolled back if issues occur:
- Previous version stored in `lpar_software` table
- `rolled_back` flag tracks rollback state
- `rolled_back_at` timestamp tracks when rollback occurred
- `rollback_reason` field explains why rollback was needed
- Does NOT affect other software in the package
- Audit log records rollback events

### Audit Logging
All entity changes logged to `audit_log` table:
- Tracks creates, updates, deletes, rollbacks, version updates
- JSON `changes` field stores before/after state
- Indexed by entity type, entity ID, and timestamp
- Optional `user_id` for user tracking (not yet implemented)

## Database Views and Functions

The database includes several powerful views and functions for common queries:

### Views (Auto-Updated)
- **`software_with_current_version`**: Software with current version details denormalized
- **`lpar_package_compliance`**: Compliance status of LPARs vs assigned packages
- **`rollback_history`**: Complete rollback history with timing analysis
- **`software_adoption_rate`**: Version adoption statistics across LPARs
- **`lpar_dashboard`** (materialized): Pre-computed dashboard metrics (refresh with `REFRESH MATERIALIZED VIEW lpar_dashboard`)

### Functions
- **`get_version_upgrade_path(software_id, from_version, to_version)`**: Returns ordered upgrade path
- **`check_package_deployment_impact(lpar_id, package_id)`**: Simulates deployment changes
- **`get_software_problem_score(software_id, days_lookback)`**: Calculates problem score from rollbacks
- **`refresh_dashboard()`**: Helper to refresh the materialized view

**Usage Example**:
```typescript
// In +page.server.ts
const compliance = await db.$queryRaw`
  SELECT * FROM lpar_package_compliance
  WHERE customer_id = ${customerId}
  AND compliance_status != 'COMPLIANT'
`;

const upgradePath = await db.$queryRaw`
  SELECT * FROM get_version_upgrade_path(
    ${softwareId}::uuid,
    'V5R4M0',
    'V5R6M0'
  )
`;
```

See `prisma/migrations/add_views_and_functions.sql` for full documentation.

## Key Files

**Database:**
- `prisma/schema.prisma`: Database schema with all models
- `prisma/seed.ts`: TypeScript seed script (alternative to SQL scripts)
- `prisma/scripts/reset.sql`: Empty all tables (preserves schema/views)
- `prisma/scripts/test-data.sql`: Load test data via SQL
- `prisma/scripts/run-sql.ts`: Helper to execute SQL scripts
- `prisma/migrations/add_views_and_functions.sql`: Database views and functions

**Application:**
- `src/lib/server/db.ts`: Database singleton and helper functions
- `src/lib/utils/version-parser.ts`: Version parsing and comparison logic
- `src/lib/schemas/index.ts`: Zod validation schemas
- `src/routes/+layout.svelte`: Navigation and page structure

## Development Notes

### When Adding New Features
1. Update Prisma schema if database changes needed
2. Run `npx prisma db push` to update database
3. Add/update Zod schemas for validation
4. Create/update TypeScript types in `src/lib/types/`
5. Implement server load functions in `+page.server.ts`
6. Build UI with existing components where possible

### Testing Data

**Option A: TypeScript Seed** (integrates with Prisma)
```bash
npx prisma db seed
```

**Option B: SQL Scripts** (production-like, more explicit)
```bash
npx tsx prisma/scripts/run-sql.ts reset-and-load
```

Both methods create the same test data:
- 2 vendors (IBM, Broadcom)
- 2 customers (Acme, Globex)
- 3 software products (CICS, DB2, Endevor)
- 8 software versions (3 versions per product showing upgrade history)
- 2 packages (Q1 2025, Q4 2024)
- 3 LPARs with installed software
- 2 audit log entries

**SQL Scripts Benefits:**
- Explicit control over data loading
- Can run reset without reloading data (useful for prod setup)
- Easier to customize for different environments
- Clearer for DBAs and ops teams

### Common Patterns
- **Soft Deletes**: All main tables have `active`, `deleted_at`, and `deleted_by` fields
- **Timestamps**: All models have `created_at` and `updated_at` (auto-managed by Prisma)
- **UUIDs**: All IDs use native PostgreSQL UUID with `gen_random_uuid()`
- **Codes**: Unique business identifiers for external reference (e.g., "PROD-LPAR-1")
- **Version History**: Normalized in `software_versions` table (not JSON)
- **Foreign Key Constraints**: All relations have explicit `onDelete` behaviors:
  - `Cascade`: Junction tables (package_items, lpar_software)
  - `Restrict`: Reference data (vendors, customers, software)
  - `SetNull`: Optional references (current_package_id, current_version_id)
- **Unique Constraints**: Prevent duplicates:
  - `[vendor_id, name]` on software (no duplicate products per vendor)
  - `[software_id, version, ptf_level]` on software_versions
  - `[package_id, order_index]` on package_items (installation order)
  - `[lpar_id, software_id]` on lpar_software (one install per LPAR)
