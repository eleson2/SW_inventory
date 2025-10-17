# SvelteKit SW Inventory - Project Structure

## Complete File Structure

```
SW_inventory/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Badge.svelte          # Badge component for tags/labels
│   │   │   │   ├── Button.svelte         # Button component with variants
│   │   │   │   ├── Card.svelte           # Card container component
│   │   │   │   ├── Input.svelte          # Form input component
│   │   │   │   ├── Label.svelte          # Form label component
│   │   │   │   ├── Table.svelte          # Table component
│   │   │   │   └── index.ts              # UI components barrel export
│   │   │   ├── common/
│   │   │   │   ├── DataTable.svelte      # Generic data table with sorting
│   │   │   │   ├── FormField.svelte      # Complete form field (label+input)
│   │   │   │   ├── Pagination.svelte     # Pagination component
│   │   │   │   └── StatusBadge.svelte    # Active/Inactive status badge
│   │   │   └── domain/
│   │   │       └── VersionDisplay.svelte # Software version display
│   │   ├── schemas/
│   │   │   └── index.ts                  # Zod validation schemas
│   │   ├── services/
│   │   │   └── package-service.ts        # Package management logic
│   │   ├── types/
│   │   │   └── index.ts                  # TypeScript type definitions
│   │   └── utils/
│   │       ├── cn.ts                     # Class name utility (clsx + tailwind-merge)
│   │       ├── date-format.ts            # Date formatting utilities
│   │       ├── version-parser.ts         # Version parsing and comparison
│   │       └── index.ts                  # Utils barrel export
│   ├── routes/
│   │   ├── customers/
│   │   │   ├── new/
│   │   │   │   ├── +page.svelte         # New customer form
│   │   │   │   └── +page.server.ts      # Create customer action
│   │   │   ├── +page.svelte             # Customer list
│   │   │   └── +page.server.ts          # Customer list data loader
│   │   ├── vendors/
│   │   │   ├── +page.svelte             # Vendor list
│   │   │   └── +page.server.ts          # Vendor list data loader
│   │   ├── software/
│   │   │   ├── +page.svelte             # Software list
│   │   │   └── +page.server.ts          # Software list data loader
│   │   ├── packages/
│   │   │   ├── +page.svelte             # Package list
│   │   │   └── +page.server.ts          # Package list data loader
│   │   ├── lpars/
│   │   │   ├── [id]/
│   │   │   │   ├── +page.svelte         # LPAR detail page
│   │   │   │   └── +page.server.ts      # LPAR detail data loader
│   │   │   ├── +page.svelte             # LPAR list
│   │   │   └── +page.server.ts          # LPAR list data loader
│   │   ├── +layout.svelte               # Root layout with navigation
│   │   └── +page.svelte                 # Home/dashboard page
│   ├── app.html                         # HTML template
│   └── app.css                          # Global styles (Tailwind)
├── .gitignore
├── package.json
├── postcss.config.js
├── README.md
├── Spec.txt                             # Requirements specification
├── svelte.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## Component Library Architecture

### UI Components (`$components/ui/`)
Base-level reusable components following shadcn design patterns:
- **Button**: Multiple variants (default, secondary, destructive, outline, ghost, link) and sizes
- **Card**: Container component for content grouping
- **Input**: Form input with error state support
- **Label**: Form label with required indicator
- **Badge**: Tag/label component for statuses and versions
- **Table**: Basic table wrapper with overflow handling

### Common Components (`$components/common/`)
Application-specific reusable components:
- **DataTable**: Full-featured table with sorting, pagination, and row click handling
- **FormField**: Complete form field combining Label + Input + error display
- **Pagination**: Page navigation with smart ellipsis handling
- **StatusBadge**: Standardized active/inactive status display

### Domain Components (`$components/domain/`)
Business domain-specific components:
- **VersionDisplay**: Formats and displays software versions with PTF levels

## Key Features & Utilities

### Version Parsing (`$utils/version-parser.ts`)
- Parse vendor designations into structured version objects
- Support for multiple version formats (V2R4M0-PTF12345, 2.4.0 (PTF 12345), etc.)
- Version comparison logic for versions and PTF levels
- Compatibility checking for package requirements

### Package Service (`$lib/services/package-service.ts`)
- Calculate customer-specific package subsets
- Validate LPAR package compliance
- Generate deployment plans for package upgrades
- Handle software rollback logic
- Calculate compatibility scores

### Validation Schemas (`$schemas/`)
Comprehensive Zod schemas for all entities:
- Customer, Vendor, Software, Package, LPAR schemas
- Create and update variants
- Pagination, sorting, and filtering schemas
- Form validation with detailed error messages

## Design Patterns

### Component Design
- Svelte 5 runes syntax (`$props`, `$state`, `$derived`)
- TypeScript for type safety
- Consistent prop naming conventions
- Reusable render props pattern for flexible rendering

### Form Handling
- SvelteKit form actions for server-side processing
- Zod validation schemas
- Comprehensive error handling and display
- Consistent form field structure

### Data Loading
- SvelteKit `load` functions in `+page.server.ts`
- Type-safe PageData with `$types`
- Pagination and sorting support
- Mock data structure for easy database integration

### Styling
- Tailwind CSS for utility-first styling
- CSS custom properties for theming
- Consistent color palette (primary, secondary, destructive, etc.)
- Responsive design utilities
- Dark mode support (theme variables included)

## Next Steps for Implementation

1. **Database Integration**
   - Add Prisma/Drizzle ORM
   - Replace mock data in `+page.server.ts` files
   - Implement CRUD operations

2. **Authentication & Authorization**
   - Add user authentication system
   - Implement role-based access control
   - Multi-tenant data isolation

3. **API Routes**
   - Create REST/GraphQL endpoints in `src/routes/api/`
   - Implement software deployment endpoints
   - Add rollback functionality

4. **Advanced Features**
   - Real-time updates (WebSocket/SSE)
   - Audit logging implementation
   - Export/import functionality
   - Reporting and analytics

5. **Testing**
   - Unit tests for utilities and services
   - Component tests with Testing Library
   - E2E tests with Playwright

## Environment Setup

Required dependencies are already listed in `package.json`:
- Svelte 5 and SvelteKit 2
- TypeScript
- Tailwind CSS (with PostCSS)
- Zod for validation
- Sveltekit-superforms for form handling
- shadcn-svelte component foundations

Run `npm install` to install all dependencies.
Run `npm run dev` to start the development server.
