# Software Inventory Management System

A comprehensive SvelteKit application for managing mainframe software inventory in a multi-tenant environment.

## Features

- **Customer Management**: Track customer information in multi-tenant environment
- **Vendor Management**: Manage software vendors and contact information
- **Software Products**: Track software with versions and PTF levels
- **Package Management**: Create coordinated software package releases
- **LPAR Monitoring**: Monitor LPAR configurations and installed software
- **Version Parsing**: Extract version and PTF level from vendor designations
- **Rollback Support**: Individual product rollback capabilities

## Tech Stack

- **Frontend**: Svelte 5, SvelteKit, TypeScript
- **Forms**: Superforms with Zod validation
- **UI Components**: Custom components based on shadcn design system
- **Styling**: Tailwind CSS

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/           # Base UI components (Button, Card, Input, etc.)
│   │   ├── common/       # Reusable components (DataTable, Pagination, FormField)
│   │   └── domain/       # Domain-specific components (VersionDisplay)
│   ├── types/            # TypeScript type definitions
│   ├── schemas/          # Zod validation schemas
│   ├── utils/            # Utility functions (version parsing, date formatting, cn)
│   └── stores/           # Svelte stores (if needed)
└── routes/
    ├── customers/        # Customer management pages
    ├── vendors/          # Vendor management pages
    ├── software/         # Software product pages
    ├── packages/         # Package management pages
    └── lpars/            # LPAR monitoring pages
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Key Concepts

### Software Versions
Software versions are parsed from vendor designations and include:
- Version number (e.g., "V2R4M0" or "2.4.0")
- PTF level (e.g., "PTF12345" or "SP1")

### Packages
Packages are collections of software products tested and deployed together:
- Include all software the service provider is responsible for
- Customers receive relevant subsets of the package
- Each LPAR can be assigned to a specific package level

### Rollback
Individual software products can be rolled back if issues occur:
- Previous version is tracked
- Rollback history is maintained
- Does not affect other software in the package

## Development Notes

- TODO markers indicate where database integration is needed
- Mock data is currently used in +page.server.ts files
- API routes can be added in src/routes/api/
- Validation schemas should be kept in sync with types

## Database Integration

To integrate a database:

1. Add your database library (e.g., Prisma, Drizzle, etc.)
2. Update the mock data in +page.server.ts files
3. Implement actual CRUD operations
4. Add authentication and authorization
5. Implement audit logging

## License

Proprietary - Internal use only
