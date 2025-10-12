# Quick Start Guide

Get your SW Inventory system up and running in minutes!

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Code editor (VS Code recommended)

## Installation

1. **Navigate to the project directory:**
   ```bash
   cd SW_inventory
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

   This will install:
   - SvelteKit 2.x
   - Svelte 5
   - TypeScript
   - Tailwind CSS
   - Zod validation
   - All UI dependencies

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   ```
   http://localhost:5173
   ```

## What You'll See

### Dashboard Page
The home page shows 5 main modules:
- 👥 Customers - Multi-tenant customer management
- 🏢 Vendors - Software vendor tracking
- 💿 Software - Product and version management
- 📦 Packages - Package release management
- 🖥️ LPARs - LPAR configuration monitoring

### Navigation
Click any module to explore:
- **List views** with sorting and pagination
- **"Add New"** buttons to create entries
- **Row clicks** to view details
- **Status badges** showing active/inactive states

### Example Pages

**Customer List** (`/customers`)
- View all customers in a table
- Sort by code, name, or status
- Click "Add Customer" to create new

**Create Customer** (`/customers/new`)
- Form with validation
- Real-time error checking
- Required field indicators

**LPAR Detail** (`/lpars/1`)
- Complete LPAR information
- Installed software list
- Package compatibility score
- Rollback capabilities

## Project Structure at a Glance

```
SW_inventory/
├── src/
│   ├── lib/
│   │   ├── components/      # Reusable UI components
│   │   ├── types/           # TypeScript definitions
│   │   ├── schemas/         # Zod validation
│   │   ├── utils/           # Helper functions
│   │   └── services/        # Business logic
│   ├── routes/              # Pages and API routes
│   ├── app.css             # Global styles
│   └── app.html            # HTML template
├── package.json            # Dependencies
└── [Documentation files]   # README, guides, etc.
```

## Key Files to Know

### Types & Validation
- `src/lib/types/index.ts` - All TypeScript types
- `src/lib/schemas/index.ts` - Zod validation schemas

### Components
- `src/lib/components/ui/` - Basic UI components
- `src/lib/components/common/` - Reusable app components
- `src/lib/components/domain/` - Domain-specific components

### Business Logic
- `src/lib/services/package-service.ts` - Package management
- `src/lib/utils/version-parser.ts` - Version parsing

### Pages
- `src/routes/+layout.svelte` - Main layout with nav
- `src/routes/+page.svelte` - Dashboard
- `src/routes/[entity]/+page.svelte` - List pages
- `src/routes/[entity]/+page.server.ts` - Data loaders

## Common Tasks

### Add a New Component

```typescript
// src/lib/components/ui/MyComponent.svelte
<script lang="ts">
  import { cn } from '$utils/cn';

  let { class: className = '', children } = $props();
</script>

<div class={cn('base-classes', className)}>
  {@render children()}
</div>
```

### Create a New Page

1. Create `src/routes/mypage/+page.svelte`
2. Create `src/routes/mypage/+page.server.ts` (if needed)
3. Add to navigation in `src/routes/+layout.svelte`

### Add Form Validation

```typescript
// In your schema file
import { z } from 'zod';

export const mySchema = z.object({
  name: z.string().min(2, 'Too short'),
  email: z.string().email('Invalid email')
});

// In your page.server.ts
try {
  const validated = mySchema.parse(formData);
  // Use validated data
} catch (error) {
  // Handle validation errors
}
```

### Parse a Version String

```typescript
import { parseVendorDesignation } from '$utils/version-parser';

const parsed = parseVendorDesignation('V2R4M0-PTF12345');
// Result: { version: 'V2R4M0', ptfLevel: 'PTF12345' }
```

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Type checking with watch mode
npm run check:watch
```

## Understanding the Mock Data

All `+page.server.ts` files currently use mock data:

```typescript
// Example: src/routes/customers/+page.server.ts
const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'Example Corp',
    // ...
  }
];
```

Look for `// TODO: Replace with actual database calls` comments.

## Next Steps

### 1. Explore the UI (No setup needed!)
- Click through all pages
- Try creating a customer
- Check the LPAR detail page
- Test form validation

### 2. Read the Documentation
- [README.md](README.md) - Project overview
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - What's been built
- [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) - Code examples
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database design

### 3. Add Real Data (When ready)
- Choose your database (PostgreSQL, MySQL, SQLite)
- Install ORM (Prisma recommended)
- Replace mock data in `+page.server.ts` files
- Add authentication

## Customization

### Change Theme Colors

Edit `src/app.css`:
```css
:root {
  --primary: 221.2 83.2% 53.3%;  /* Change these values */
  --secondary: 210 40% 96.1%;
  /* ... */
}
```

### Modify Navigation

Edit `src/routes/+layout.svelte`:
```svelte
<nav class="flex items-center space-x-6">
  <a href="/customers">Customers</a>
  <a href="/your-new-page">New Page</a>
</nav>
```

### Add a New Entity

1. Add type to `src/lib/types/index.ts`
2. Add schema to `src/lib/schemas/index.ts`
3. Create routes in `src/routes/entity-name/`
4. Add to navigation

## Troubleshooting

### Port Already in Use
```bash
# Use a different port
npm run dev -- --port 3000
```

### TypeScript Errors
```bash
# Sync SvelteKit types
npm run check
```

### Styles Not Loading
```bash
# Restart dev server
# Clear browser cache
```

### Components Not Found
Check that path aliases are working:
```typescript
import Button from '$components/ui/Button.svelte';  // ✅ Good
import Button from '../lib/components/ui/Button.svelte';  // ❌ Don't use relative
```

## Features You Can Use Right Now

✅ **All UI components** - Buttons, Cards, Inputs, Tables, Badges
✅ **Form validation** - Zod schemas with error messages
✅ **Version parsing** - Parse and compare software versions
✅ **Date formatting** - Multiple date display formats
✅ **Package logic** - Calculate compatibility, generate plans
✅ **Navigation** - Full app navigation structure
✅ **Layouts** - Responsive design with Tailwind
✅ **Type safety** - Full TypeScript coverage

## Getting Help

### Documentation Files
- [README.md](README.md) - General overview
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - File organization
- [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) - Code patterns
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database design
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Complete feature list

### In-Code Help
- Look for `// TODO:` comments
- Check inline documentation
- Review mock data structure
- See example implementations

## What's Working vs What Needs Database

### ✅ Fully Functional (No DB needed)
- All UI components
- Form validation
- Version parsing and comparison
- Date formatting
- Page routing
- Navigation
- Layout and styling
- Package business logic

### 🔄 Needs Database Integration
- Actual data persistence
- User authentication
- Data fetching (currently mock)
- Form submissions (validation works, saving needs DB)
- Search and filtering (UI ready, backend needs DB)

## Quick Tips

1. **Use path aliases** - Import from `$lib`, `$components`, `$types`, etc.
2. **Check types** - Run `npm run check` to catch type errors
3. **Use the examples** - [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) has copy-paste code
4. **Follow patterns** - Existing pages show the structure
5. **Read TODOs** - They mark where DB integration is needed

## Your Development Flow

1. **Start dev server** - `npm run dev`
2. **Make changes** - Edit files and see instant updates
3. **Check types** - Run `npm run check` periodically
4. **Test in browser** - Navigate through your changes
5. **Build** - `npm run build` when ready for production

## Enjoy!

You now have a complete, working SvelteKit application with modern best practices. All the hard work of structure, components, types, and validation is done. Just add your database and you're ready for production! 🚀

**Happy coding!**
