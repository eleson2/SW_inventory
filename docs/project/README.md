# Software Inventory Management System - Project Documentation

## Overview

The Software Inventory Management System is a comprehensive web application designed for managing mainframe software inventory in a multi-tenant environment. It provides a centralized platform for tracking software vendors, products, versions, deployment packages, and LPAR (Logical Partition) configurations.

## Business Purpose

This system addresses the complex challenge of managing software across multiple customer environments (LPARs) in a mainframe service provider context:

- **Multi-Tenant Management**: Track software installations across multiple customer environments
- **Version Control**: Maintain detailed version history with PTF (Program Temporary Fix) levels
- **Package Coordination**: Bundle software products into tested, coordinated releases
- **Deployment Tracking**: Monitor what software is installed where
- **Rollback Capability**: Quickly revert problematic software updates
- **Audit Trail**: Complete history of all changes to the system

## Key Concepts

### Entities

#### Vendors
Software manufacturers (e.g., IBM, Broadcom, BMC). Each vendor produces multiple software products.

#### Software
Individual software products (e.g., CICS, DB2, Endevor). Each product:
- Belongs to a vendor
- Has multiple versions over time
- Is tracked across customer installations

#### Software Versions
Normalized version history for each software product:
- **Version Number**: Following vendor format (e.g., V5R6M0, 2.4.0)
- **PTF Level**: Vendor-specific fix/service pack level (e.g., PTF12345, SO12345)
- **Release Date**: When the version was released
- **End of Support**: When the version loses support
- **Release Notes**: Documentation about the version
- **Current Flag**: Marks the recommended/latest version

#### Packages
Coordinated software releases containing multiple products tested together:
- Include ALL software the service provider manages
- Each item specifies a specific software version
- Installation order is defined via order_index

#### Customers
Organizations that own LPARs (customer environments)

#### LPARs (Logical Partitions)
Customer environments where software runs:
- Each LPAR belongs to one customer
- Assigned to a specific package version
- Tracks currently installed software with version history
- Can have different versions than the assigned package (due to rollbacks)

### Workflows

#### Package Deployment
1. Service provider creates a package with tested software versions
2. Package is assigned to one or more LPARs
3. System shows what needs to be installed/updated on each LPAR
4. Installation is tracked with timestamps and audit logs

#### Rollback Process
1. If software causes issues after deployment, individual products can be rolled back
2. System tracks:
   - Previous version that was installed
   - Rollback timestamp
   - Reason for rollback
   - Who performed the rollback
3. Rollback does NOT affect other software in the package
4. Full audit trail is maintained

## Technical Architecture

### Technology Stack

**Frontend**
- Svelte 5 (latest reactive UI framework)
- SvelteKit (full-stack framework)
- TypeScript (type safety)
- Tailwind CSS (utility-first styling)

**Forms & Validation**
- Superforms 2.0 (advanced form handling)
- Zod (schema validation)

**Backend**
- SvelteKit server routes
- Prisma ORM (database toolkit)
- PostgreSQL (relational database)

**UI Components**
- Custom components based on shadcn/ui design patterns
- Full dark mode support
- Responsive design for mobile/tablet/desktop

### Project Structure

```
SW_inventory/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/              # Base UI components (Button, Card, Badge, etc.)
│   │   │   ├── common/          # Reusable components (DataTable, Forms, etc.)
│   │   │   └── domain/          # Business-specific components
│   │   ├── server/              # Server-side utilities
│   │   │   ├── db.ts            # Prisma client & database helpers
│   │   │   ├── filter-builders.ts  # Reusable query filters
│   │   │   └── form-actions.ts  # Generic form action factories
│   │   ├── schemas/             # Zod validation schemas
│   │   ├── types/               # TypeScript type definitions
│   │   ├── utils/               # Utility functions
│   │   └── constants/           # Application constants
│   └── routes/                  # SvelteKit file-based routing
│       ├── api/                 # API endpoints
│       ├── customers/           # Customer management
│       ├── vendors/             # Vendor management
│       ├── software/            # Software catalog
│       ├── packages/            # Package management
│       ├── lpars/               # LPAR monitoring
│       ├── reports/             # Reporting pages
│       └── activity/            # Activity/audit logs
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Database migrations
│   └── scripts/                 # Database utility scripts
└── docs/                        # Documentation (you are here!)
```

### Design Patterns

#### Server-Side Rendering (SSR)
All pages use SvelteKit's SSR for:
- Faster initial page load
- Better SEO (though not needed for internal apps)
- Type-safe data loading

#### Form Validation
- Client-side: Immediate feedback using Zod schemas
- Server-side: Same Zod schemas for security
- Progressive enhancement: Works without JavaScript

#### Database Access
- Prisma ORM for type-safe queries
- Transaction support for complex operations
- Connection pooling for performance
- Soft deletes (active flag instead of DELETE)

#### Code Reusability
- Generic page loader (`createPageLoader`) for listing pages
- Generic form actions (`createFormAction`) for CRUD operations
- Shared filter builders for common query patterns
- Component composition with Svelte 5 snippets

## Database Schema

### Core Tables

**vendors**
- id (UUID)
- name, code (unique)
- website, contact_email
- active (soft delete)
- created_at, updated_at

**software**
- id (UUID)
- vendor_id (FK to vendors)
- name, description
- current_version_id (FK to software_versions)
- active
- created_at, updated_at

**software_versions**
- id (UUID)
- software_id (FK to software)
- version, ptf_level
- release_date, end_of_support
- release_notes
- is_current (boolean flag)
- created_at, updated_at

**packages**
- id (UUID)
- name, code, version
- release_date
- description
- active
- created_at, updated_at

**package_items**
- id (UUID)
- package_id (FK to packages)
- software_id (FK to software)
- software_version_id (FK to software_versions)
- order_index (installation order)
- created_at, updated_at

**customers**
- id (UUID)
- name, code (unique)
- description
- active
- created_at, updated_at

**lpars**
- id (UUID)
- customer_id (FK to customers)
- name, code
- description
- current_package_id (FK to packages)
- active
- created_at, updated_at

**lpar_software**
- id (UUID)
- lpar_id (FK to lpars)
- software_id (FK to software)
- software_version_id (FK to software_versions)
- installed_date
- previous_version_id (for rollback)
- rolled_back (boolean)
- rolled_back_at (timestamp)
- rollback_reason (text)
- created_at, updated_at

**audit_log**
- id (UUID)
- entity_type, entity_id
- action (create, update, delete, rollback)
- changes (JSONB - before/after state)
- user_id (optional)
- created_at

### Database Views

The system includes several PostgreSQL views for complex queries:

- **software_with_current_version**: Software with current version denormalized
- **lpar_package_compliance**: Shows which LPARs are compliant with assigned packages
- **rollback_history**: Complete rollback history with timing analysis
- **software_adoption_rate**: Version adoption statistics across LPARs
- **lpar_dashboard**: Pre-computed dashboard metrics (materialized view)

See `prisma/migrations/add_views_and_functions.sql` for details.

## Security Considerations

### Current State
- Internal application (not exposed to internet)
- No authentication implemented yet
- Audit logging captures all changes
- Soft deletes prevent accidental data loss

### Future Enhancements
- Add authentication (e.g., OAuth, SAML)
- Implement role-based access control (RBAC)
- Add user management
- Implement row-level security in PostgreSQL
- Add API rate limiting
- Implement CSRF protection

## Performance Considerations

### Implemented Optimizations
- Server-side pagination (default 20 items per page)
- Database indexes on frequently queried columns
- Materialized views for complex reports
- Connection pooling via Prisma
- Efficient database queries with proper includes

### Future Optimizations
- Redis caching for frequently accessed data
- Database query optimization based on usage patterns
- Lazy loading for large datasets
- Virtual scrolling for very large tables
- Background jobs for heavy operations

## Monitoring & Maintenance

### Audit Logging
All entity changes are logged to the `audit_log` table:
- Who made the change (when authentication is added)
- What changed (before/after state)
- When the change occurred
- Type of action (create, update, delete, rollback)

### Database Maintenance
- Regular backups (implement backup strategy)
- Periodic refresh of materialized views
- Monitor database size and performance
- Clean up old audit logs (retention policy)

## Development Workflow

### Adding a New Entity
1. Update Prisma schema (`prisma/schema.prisma`)
2. Create migration: `npx prisma migrate dev`
3. Create Zod validation schema in `src/lib/schemas/`
4. Add TypeScript types in `src/lib/types/`
5. Create CRUD routes in `src/routes/[entity]/`
6. Implement server load functions and form actions
7. Build UI using existing components
8. Add to navigation in `src/routes/+layout.svelte`
9. Update documentation

### Testing Strategy
- Manual testing in development
- Test database operations in isolation
- Verify form validation (client & server)
- Test edge cases (empty states, errors)
- Check mobile responsiveness

### Deployment
1. Build production bundle: `npm run build`
2. Run production server: `node build`
3. Configure environment variables
4. Set up reverse proxy (nginx, Apache)
5. Enable HTTPS
6. Configure database backups
7. Set up monitoring

## License

Proprietary - Internal use only
