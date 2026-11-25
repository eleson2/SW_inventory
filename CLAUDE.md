# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Software Inventory Management System for tracking mainframe software in a multi-tenant environment. Built with SvelteKit, TypeScript, Prisma, and PostgreSQL or SQLite.

## Development Commands

### Setup & Database
```bash
npm install                                        # Install dependencies
npm run db:generate                               # Generate Prisma client for the provider in DATABASE_URL
npm run db:push                                   # Push schema to database

# Data Management - Choose one approach:

# Option A: TypeScript seed script
npm run db:seed                                   # Seed via TypeScript (seed.ts); both providers

# Option B: SQL scripts (PostgreSQL only)
npx tsx prisma/scripts/run-sql.ts reset           # Empty all tables
npx tsx prisma/scripts/run-sql.ts test-data       # Load test data
npx tsx prisma/scripts/run-sql.ts reset-and-load  # Reset + load (full refresh)

# Database Tools
npm run db:studio                                 # Open Prisma Studio on http://localhost:5556
npm run db:export                                 # Dump all tables to backup/*.json
npm run db:import [-- --replace]                  # Load backup/*.json into the current database
npm run check:portable                            # Fail on raw SQL / Postgres-only Prisma options in src/

# Demo server (DEPLOY_HOST in .env; server side is deploy/remote.sh, see DEPLOY.md part 2)
npm run deploy                                    # deploy pushed HEAD; backs up server data, rolls back on failure
npm run deploy -- data:pull [--load]              # server data -> backup/server-<time>/ (--load: into local DB)
npm run deploy -- data:push [--dir <export>]      # replace server data (server backed up first)
npm run deploy -- status | backup | backups | restore <name>
npm run deploy -- setup-sudo                      # once, from a terminal: password-less sudo for the server script

# Vendor bundles (fetch from vendor sites into bundles/<LEVEL>.csv, then import on /import)
npm run bundles:fetch -- ibm RSU2510                      # IBM CST/RSU report (public)
npm run bundles:fetch -- broadcom CARS2510 --products AL2121,CCS150
npm run bundles:fetch -- broadcom CARS2510                # product codes from software.product_code
npm run bundles:import -- bundles/RSU2510.csv --check     # dry run (SQLite: on a temp copy), report + checks
npm run bundles:import -- bundles/RSU2510.csv             # import without the UI ("!" lines need a decision)
npm run bundles:import -- --codes BROADCOM                # list / --set-code BROADCOM "CA 7" AL2121 / --rename
```
The `import-vendor-bundle` skill (`.claude/skills/`) drives fetch -> check -> import using only these scripts.

### Tests & CI
```bash
npm run test:unit                                  # src + scripts
TEST_DATABASE_URL=file:./test.db npm run test:integration   # needs prisma/test.db with the schema pushed
npx playwright test --project=chromium             # e2e: own server on :5174, fresh seeded prisma/e2e.db, test login
```
`.github/workflows/tests.yml` runs these on every PR/push and nightly (SQLite, Node 26). The e2e
job is non-blocking until the specs match the current UI. E2E needs a SQLite Prisma client.

Agent cost metering (`scripts/agent-cost.ts`): issue comments are the ledger.
```bash
npm run agent:cost -- record result.json --issue 12 --agent fixer --post   # from claude -p --output-format json
npm run agent:cost -- summary --issue 12 --post                            # actual vs <!-- cost-estimate --> block
npm run agent:cost -- report > costs.csv                                   # all issues
npm run agent:cost -- gate --issue 12 --max-usd 15                         # exit 2 = agent may not start
```
Agent workflows run on the Claude **subscription only** (secret `CLAUDE_CODE_OAUTH_TOKEN` from
`claude setup-token`; never add an `ANTHROPIC_API_KEY` secret):
- `claude-estimate.yml`: label `bug` / `proposal` -> read-only estimate comment + its own cost.
- `claude-fix.yml`: label `claude-fix` -> gate (proposals need `approved`; estimate above
  `AGENT_MAX_USD`, default $15, needs `approved`) -> fix on a branch + PR -> actual vs estimate.
- Both require **2x headroom**: remaining % of the 5-hour and the weekly window >= 2 x the run's
  expected use (`scripts/agent-usage.ts`; fails closed). Expected use = estimate $ x percent-per-$
  (repo vars `AGENT_PCT_PER_USD_5H` / `_7D`, defaults 4 / 0.5).
- Usage source: repo variable `AGENT_USAGE_SNAPSHOT`, published from the owner's PC. The
  Claude Code status line (`~/.claude/usage-statusline.js`) saves `rate_limits` to
  `~/.claude/usage-snapshot.json`; scheduled task `SWInv-PublishUsage` (every 15 min) runs
  `node scripts/publish-usage.ts`. Old snapshots are safe: passed resets count as empty, agent
  runs since are added. (`api/oauth/usage` returns 403 for `setup-token` tokens.)
- `agent-usage.yml` (manual): shows the usage the gates see.

### Development
```bash
npm run dev                   # Start dev server on http://localhost:5173
npm run build                 # Build for production
npm run preview               # Preview production build
npm run check                 # Type-check without watching
npm run check:watch           # Type-check with watch mode
```

### Database Connection & Providers
`DATABASE_URL` selects the database **and** the provider:
- PostgreSQL: `postgresql://user:pass@host:5432/sw_inventory?schema=public`
- SQLite: `file:./dev.db` (relative to `prisma/`, so this is `prisma/dev.db`). Optionally add
  `?socket_timeout=10` to wait up to 10 s for write locks.

`prisma/schema.prisma` (PostgreSQL) is the single source of truth. For SQLite, `scripts/db.ts`
derives `prisma/schema.sqlite.prisma` (git-ignored) by stripping `@db.*` native types and
replacing `gen_random_uuid()` with `uuid()`. **Always use the `npm run db:*` scripts** instead
of bare `npx prisma ...`, which would always use the Postgres schema.

The provider is fixed when the client is generated. To switch databases:
```bash
npm run db:export                 # 1. dump data from the current database
# 2. change DATABASE_URL in .env, and stop the dev server (it locks the Prisma engine on Windows)
npm run db:generate               # 3. regenerate the client for the new provider
npm run db:push                   # 4. create the tables
npm run db:import                 # 5. load the data
```

**Portability rules for app code** (enforced by `npm run check:portable`):
- No `$queryRaw` / `$executeRaw` in `src/`; use Prisma queries.
- Case-insensitive search: `textContains(value)` from `#lib/server/db-dialect.ts`, never
  `mode: 'insensitive'` (does not exist on SQLite; SQLite ignores case for ASCII only).
- No `createMany({ skipDuplicates })`; filter out existing rows first.
- Anything genuinely provider-specific goes in `src/lib/server/db-dialect.ts`.
- SQLite allows one writer at a time; use `transactionTimeouts()` for interactive transactions.

### Authentication & Deployment
Single-user login for demos. `src/hooks.server.ts` requires a valid session for every route except
`/login` (pages redirect to `/login`, `/api/*` returns 401). Credentials and the cookie-signing secret
come from `AUTH_USERNAME`, `AUTH_PASSWORD`, `AUTH_SECRET` (declared in `src/env.ts`, read via
`$app/env/private`; the app refuses to start without them). Logic lives in `src/lib/server/auth.ts`.

Built with `@sveltejs/adapter-node`: `npm run build`, then `node build` on the server with
`DATABASE_URL`, the `AUTH_*` vars and `ORIGIN=https://your.host` set (see `.env.example`).
Use Node 26 LTS (tested; 22/24 also work). SvelteKit 3.4's build crashes on Node 25 (`styleText('grey')`).

## Architecture

### Data Model Hierarchy

The system follows this entity relationship:
- **Vendors** → create **Software** products
- **Software** → has multiple **Software Versions** (normalized table)
- **Software Versions** → referenced by **Package Items**
- **Packages** → contain **Package Items** → assigned to **LPARs**
- **Customers** → own **LPARs**
- **LPARs** → track installed **Software** with version history via **lpar_software**
- **Vendors** → publish **Vendor Bundles** (Broadcom CARS, IBM RSU) → **Vendor Bundle Items** (software versions)
- **Packages** are built from one or more bundles: items are *copied* and keep `source_bundle_id`

**Key Tables**:
- `software_versions`: Normalized version history (replaces JSON `version_history`)
- `package_items`: Links packages to specific software versions
- `lpar_software`: Current and previous versions installed on each LPAR
- `vendor_bundles` / `vendor_bundle_items`: vendor maintenance levels (`CARS2511`, `RSU2511`).
  A level is complete (every product of the vendor's level) and *references* `software_versions`;
  a version/PTF level is stored once and shared by every level, package and LPAR that has it.
  PTF level convention: IBM = the RSU code (`RSU2511`, no per-product PTFs are published);
  Broadcom = the product's highest PTF in the level (`LU17806`). The level code and PTF count go in `notes`

### Vendor Bundles
- Server logic in `src/lib/server/bundles.ts` (`saveBundle`, `importBundleRows`, `resolveVersion`).
  Versions that don't exist yet are created automatically with `is_current: false`.
  `resolveVersion` matches regardless of notation/case ("6.1"/"rsu2510" = "V6R1M0"/"RSU2510").
- Import carries forward: products in the vendor's previous level of the same type but not in
  the file (Broadcom lists only products with new PTFs) keep their previous version
  (note "Unchanged since CARS2510"). When cloning a level, only the ticked (changed) items get a
  new PTF level.
- Packages: `BundlePicker.svelte` merges bundles into package items via the pure
  `mergeBundlesIntoItems()` (`src/lib/utils/bundle-merge.ts`); existing software gets the bundle's
  version (reported as a conflict). `PackageItemsManager` shows each item's source: bundle code,
  "adjusted" (version differs from the bundle) or "Manual". `/packages/new?bundles=<id>,<id>` preselects.
- "Clone as next level" (`/bundles/new?clone=<id>`) copies items and suggests the next code
  (`nextBundleCode`: CARS2511 → CARS2512).
- `software.product_code` matches fetched/imported rows (Broadcom: product+release, e.g. `AL2121`;
  IBM: report name without spaces, e.g. `CICSTS`), then the software name.
- CSV columns (`BUNDLE_CSV_COLUMNS` in `src/lib/schemas/bundle.ts`): `vendor_code, bundle_code,
  bundle_name, bundle_type, release_date, product_code, product_name, version, ptf_level, notes,
  source_url, end_of_support` (the last two optional). Re-importing a bundle replaces its items. Products not in the inventory are
  added under the vendor (their highest release becomes current). Every release the vendor
  lists is kept (a level may hold Db2 12 and 13), written in the inventory's notation by
  `spellLikeInventory()` ("5.6" -> "V5R6M0", "12" -> "V12R1M0", "6.3" -> "V6R3M0").
  The vendor's own spelling is kept in `software_versions.vendor_version` ("6.1" on V6R1M0),
  matched on import too, and shown as `V6R1M0 [6.1]` via `versionName()`. One row per release.
- Adding a bundle to a package (`mergeBundlesIntoItems`): software already in the package moves
  to the bundle's level of the *same release* (kept and reported if the bundle lacks it);
  software not in the package gets the bundle's highest release.
  The "Latest release only" checkbox (`latestOnly`) moves software already in the package to
  the bundle's highest release instead (Db2 12 -> 13).
- Fetchers in `scripts/fetch-bundles/` (run locally only; the app never contacts vendor sites).
  Parsers are tested against text fixtures from real PDFs in `__fixtures__/`; vendor PDF
  layouts are not an API, so a parser test failing on a new layout is the expected signal.

### Reports
- `/reports` lists all reports by goal; report IDs (R1, L1, V4...) match the "Reporting Needs" doc.
- Every report uses the shared scope: `readScope(url)` / `lparWhere` / `softwareWhere` /
  `loadFilterOptions()` in `src/lib/server/report-scope.ts` and `ReportFilters.svelte`
  (`src/lib/components/reports/`). URL params: `customer`, `lpar`, `vendor`, `software`, `set` (ids).
- LPAR sets (`lpar_sets`, `lpar_set_members`): saved fixed LPAR selections, `/reports/lpar-sets`.
- R1 `/reports/installed`: pure logic in `src/lib/utils/installed-matrix.ts` (cell status vs the
  LPAR's package: match/behind/ahead/not_in_package/missing/no_package), query `getInstalledMatrix()`
  in `src/lib/server/reports.ts`, CSV at `/reports/installed/export` (one row per LPAR x product).
- R3 `/reports/vendor-base`: per product x release (LPARs, customers, share, PTF range), "Per customer"
  pivot; logic in `src/lib/utils/vendor-base.ts`, CSV one row per product x release x customer.
- C1 `/reports/customer-statement`: customer-facing print layout, one statement per customer (page
  break), reuses `getInstalledMatrix()`; "Changes since" (`?since=`) from `lpar_software` install /
  rollback dates (`getStatementChanges()`). No rollback reasons or internal notes on it.
- L1 `/reports/end-of-support`: installed product x release with its end-of-support date (latest date of
  any PTF level of the release), out of support red, ending within `EOS_WARNING_MONTHS` (12) amber;
  logic in `src/lib/utils/end-of-support.ts`, CSV one row per release x LPAR.
- L2 `/reports/package-compliance`: one row per LPAR summarising R1 (`buildCompliance()` in
  `src/lib/utils/package-compliance.ts`). Compliance = match / (package items + installed outside the
  package): software outside the package counts against it. LPARs without a package have no %.
- L4 `/reports/maintenance-level`: per LPAR x vendor the newest vendor bundle (RSU/CARS) every product of
  that vendor on the LPAR reaches (`reachesLevel()`: same release, else the bundle's highest), aged
  green < 6 months, amber <= 12, red older; logic in `src/lib/utils/maintenance-level.ts`.
- V4 `/reports/quality` (`?from=&to=`, default last 12 months) and L5 `/reports/open-rollbacks` (flagged
  after 30 days): logic in `src/lib/utils/rollbacks.ts`. V4 counts every rollback from `audit_log`
  (action `rollback`, `changes.software_id`), plus `lpar_software.rolled_back_at` rows without an audit entry.
- Report-specific URL params survive Apply via `<ReportFilters keep={['since']}>`. CSV via
  `toCsv()` / `csvDownload()` in `src/lib/utils/csv.ts`.
- End of support is per release: setting it (Add version page, bundle CSV `end_of_support` column)
  updates every PTF level of that release, and new PTF levels inherit it.
- `createAuditLog(..., userId, tx)` inside `db.$transaction`: on the main connection it waits for
  the transaction's write lock on SQLite until the transaction times out.

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
import { db } from '#lib/server/db.ts';
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

SvelteKit 3 uses Node subpath imports, declared in the `"imports"` field of `package.json`
(there is no `svelte.config.js`; Kit config lives in the `sveltekit()` plugin in `vite.config.ts`):
```typescript
#lib/*        → src/lib/*      // e.g. '#lib/components/ui/Card.svelte', '#lib/server/db.ts'
```
Imports must include the file extension (`.ts`, `.svelte`, `.svelte.ts`). The old
`$lib`, `$components`, `$types`, `$utils`, `$stores`, `$schemas` aliases no longer exist.

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

## Database Views and Functions (PostgreSQL only, optional)

`prisma/postgres-extras/` holds optional PostgreSQL views, functions, partial and trigram
indexes. **The app does not use them** and they do not exist on SQLite; do not query them
from app code. They are available for ad-hoc SQL on a PostgreSQL database:

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

**Usage Example** (ad-hoc psql/scripts only, not app code):
```typescript
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

See `prisma/postgres-extras/add_views_and_functions.sql` for full documentation.

## Key Files

**Database:**
- `prisma/schema.prisma`: Database schema with all models (PostgreSQL; source of truth for both providers)
- `scripts/db.ts`: Provider-aware Prisma CLI wrapper; derives `prisma/schema.sqlite.prisma`
- `scripts/db-transfer.ts`: `db:export` / `db:import` (JSON, provider-neutral)
- `scripts/check-portable.ts`: Guards against non-portable database code in `src/`
- `prisma/lib/clear-data.ts`: Portable "empty all tables" (used by tests, reset, import)
- `prisma/seed.ts`: TypeScript seed script (works on both providers)
- `scripts/fetch-bundles/`: Broadcom CARS / IBM RSU fetchers writing bundle CSVs
- `prisma/scripts/reset.sql`: Empty all tables (PostgreSQL only)
- `prisma/scripts/test-data.sql`: Load test data via SQL (PostgreSQL only)
- `prisma/scripts/run-sql.ts`: Helper to execute SQL scripts (PostgreSQL only)
- `prisma/postgres-extras/`: Optional PostgreSQL-only views, functions and indexes

**Application:**
- `src/lib/server/db.ts`: Database singleton and helper functions
- `src/lib/server/db-dialect.ts`: The only place for provider-specific query code
- `src/lib/utils/version-parser.ts`: Version parsing and comparison logic
- `src/lib/schemas/index.ts`: Zod validation schemas
- `src/routes/+layout.svelte`: Navigation and page structure

## Development Notes

### When Adding New Features
1. Update Prisma schema if database changes needed (`prisma/schema.prisma` only; use only
   attributes that `scripts/db.ts` can translate for SQLite)
2. Run `npm run db:push` to update database
3. Add/update Zod schemas for validation
4. Create/update TypeScript types in `src/lib/types/`
5. Implement server load functions in `+page.server.ts`
6. Build UI with existing components where possible

### Testing Data

**Option A: TypeScript Seed** (integrates with Prisma)
```bash
npm run db:seed
```

**Option B: SQL Scripts** (PostgreSQL only)
```bash
npx tsx prisma/scripts/run-sql.ts reset-and-load
```

Both methods create the same test data:
- 2 vendors (IBM, Broadcom)
- 2 customers (Acme, Globex)
- 3 software products (CICS, DB2, Endevor)
- 8 software versions (3 versions per product showing upgrade history)
- 2 vendor bundles (Broadcom CARS2410 with Endevor, IBM RSU2410 with CICS and DB2)
- 2 packages (Q1 2025 built from both bundles, Q4 2024 manual)
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
  - `[bundle_id, software_version_id]` on vendor_bundle_items (several releases per software)
