# 🚀 SW Inventory - Quick Reference

## 📍 Access Points

| Service | URL | Status |
|---------|-----|--------|
| **Application** | http://localhost:5174 | ✅ Running |
| **Prisma Studio** | http://localhost:5556 | ✅ Running |
| **Database** | localhost:5432/sw_inventory | ✅ Connected |

## 🔑 Credentials

- **PostgreSQL User**: `postgres`
- **PostgreSQL Password**: `postgres`
- **Database**: `sw_inventory`

## 📦 Sample Data

- **2 Vendors**: IBM, Broadcom
- **2 Customers**: Acme Corporation, Globex Industries
- **3 Software**: CICS, DB2, Endevor
- **2 Packages**: Q1 2025, Q4 2024
- **3 LPARs**: Production, Test, Globex

## 🛠️ Common Commands

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run check        # TypeScript check
```

### Database
```bash
npx prisma studio    # Open database browser
npx prisma db push   # Push schema changes
npx prisma db seed   # Seed sample data
npx prisma generate  # Generate Prisma Client
```

### Migration
```bash
run_migration.bat    # Run performance enhancements
```

## 📂 Key Files

### Configuration
- `.env` - Database connection string
- `prisma/schema.prisma` - Database schema
- `package.json` - Dependencies

### Business Logic
- `src/lib/server/db.ts` - Database utilities
- `src/lib/server/clone-utils.ts` - Clone functionality
- `src/lib/services/package-service.ts` - Package management

### Components
- `src/lib/components/ui/` - Base UI components
- `src/lib/components/common/` - Reusable components
- `src/lib/components/domain/` - Domain-specific

### Routes
- `src/routes/customers/` - Customer management
- `src/routes/vendors/` - Vendor management
- `src/routes/software/` - Software products
- `src/routes/packages/` - Package management
- `src/routes/lpars/` - LPAR monitoring
- `src/routes/api/clone/` - Clone API

## 🔄 Clone Feature

### Via API
```javascript
// Clone software
const response = await fetch('/api/clone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'software',
    sourceId: 'uuid',
    data: { name: 'New Software Name' }
  })
});

// Clone package
const response = await fetch('/api/clone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'package',
    sourceId: 'uuid',
    data: {
      name: 'Q2 2025 Package',
      code: 'MF-Q2-2025',
      version: '2025.2.0'
    }
  })
});

// Clone LPAR
const response = await fetch('/api/clone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'lpar',
    sourceId: 'uuid',
    data: {
      name: 'Test LPAR 2',
      code: 'TEST-LPAR-2',
      customerId: 'optional-uuid'
    }
  })
});
```

### Via Component
```svelte
<CloneDialog
  bind:open={showDialog}
  title="Clone Software"
  entityType="Software"
  sourceName={software.name}
  fields={[
    { name: 'name', label: 'New Name', required: true }
  ]}
  preview={previewData}
  onClone={handleClone}
/>
```

## 🗄️ Database Functions

### Compatibility Score
```sql
SELECT get_lpar_package_compatibility(
  'lpar-uuid',
  'package-uuid'
);
-- Returns: 85 (percentage)
```

### Global Search
```sql
SELECT * FROM global_search('search term', 20);
-- Searches across all entities
```

### Clone in Database
```sql
-- Clone software
SELECT clone_software('source-id', 'New Name');

-- Clone package
SELECT clone_package('source-id', 'New Name', 'CODE', '1.0');

-- Clone LPAR
SELECT clone_lpar('source-id', 'New Name', 'CODE', 'customer-id');
```

## 🎨 UI Components

### Button
```svelte
<Button variant="default|secondary|destructive|outline|ghost">
  Click Me
</Button>
```

### Form Field
```svelte
<FormField
  label="Name"
  id="name"
  name="name"
  bind:value={formData.name}
  required
  error={errors.name}
/>
```

### Data Table
```svelte
<DataTable
  data={items}
  columns={columns}
  onRowClick={handleClick}
  onSort={handleSort}
/>
```

### Status Badge
```svelte
<StatusBadge active={item.active} />
```

### Version Display
```svelte
<VersionDisplay
  version={{ version: 'V5R6M0', ptfLevel: 'PTF12345' }}
  showBadge={true}
/>
```

## 📊 Performance Tips

### Use Indexes
The system has 15+ indexes for:
- Customer/vendor/software name searches
- LPAR-package relationships
- JSONB version history
- Full-text search

### Use Functions
PostgreSQL functions for:
- Compatibility calculations
- Version queries
- Cloning operations
- Global search

### Query Optimization
```typescript
// ✅ Good: Use getPaginated
const result = await getPaginated(db.customer, page, pageSize, where, orderBy);

// ✅ Good: Select specific fields
const customers = await db.customer.findMany({
  select: { id: true, name: true, code: true }
});

// ❌ Avoid: Loading everything without pagination
const all = await db.customer.findMany();
```

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Test connection
npx prisma db pull

# Regenerate client
npx prisma generate

# Restart dev server
# Press Ctrl+C, then:
npm run dev
```

### Port Already in Use
The app will auto-select another port (5174, 5175, etc.)

### Prisma Client Errors
```bash
npx prisma generate
npm run dev
```

## 📚 Documentation

- [README.md](README.md) - Project overview
- [QUICKSTART.md](QUICKSTART.md) - Get started guide
- [DATABASE_READY.md](DATABASE_READY.md) - Database setup
- [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) - PostgreSQL guide
- [ENHANCEMENTS_COMPLETE.md](ENHANCEMENTS_COMPLETE.md) - New features
- [USAGE_EXAMPLES.md](USAGE_EXAMPLES.md) - Code examples
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - File organization
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Schema details

## 🎯 Quick Tasks

### View Data
1. Open http://localhost:5556 (Prisma Studio)
2. Browse any table
3. Edit data directly

### Create Customer
1. Go to http://localhost:5174/customers/new
2. Fill form
3. Submit
4. See in database!

### Clone Software, Package, or LPAR
1. Navigate to any detail page:
   - Software: http://localhost:5174/software/{id}
   - Package: http://localhost:5174/packages/{id}
   - LPAR: http://localhost:5174/lpars/{id}
2. Click the "Clone" button
3. Fill in the required fields
4. Submit to create a copy with all relationships

### Search
```sql
-- In Prisma Studio or psql
SELECT * FROM global_search('acme', 10);
```

## 🚀 Production Checklist

- [ ] Run `npm run build`
- [ ] Set production DATABASE_URL
- [ ] Run migrations: `run_migration.bat`
- [ ] Add authentication
- [ ] Enable HTTPS
- [ ] Set up backups
- [ ] Configure monitoring
- [ ] Add error tracking
- [ ] Set up CI/CD

---

**Everything is ready to use!** 🎉

For questions, check the documentation files above.
