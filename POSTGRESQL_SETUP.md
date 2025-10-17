# PostgreSQL Setup Guide

Complete guide for setting up PostgreSQL with your SW Inventory system.

## ✅ What's Already Done

Your application is **fully integrated with PostgreSQL**:
- ✅ Prisma ORM installed and configured
- ✅ Complete database schema created ([prisma/schema.prisma](prisma/schema.prisma))
- ✅ Database utility functions ([src/lib/server/db.ts](src/lib/server/db.ts))
- ✅ All routes updated to use Prisma queries (no more mock data!)
- ✅ Prisma Client generated and ready to use

## What You Need To Do

You just need to **set up a PostgreSQL database** and run the migrations. Here are your options:

---

## Option 1: Local PostgreSQL (Recommended for Development)

### Install PostgreSQL

**Windows:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer (default settings work fine)
3. Remember the password you set for `postgres` user

**Mac (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE sw_inventory;

# Create user (optional but recommended)
CREATE USER sw_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sw_inventory TO sw_user;

# Exit
\q
```

### Update .env File

The `.env` file is already configured. Just update if your credentials are different:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sw_inventory?schema=public"
```

Or if you created a custom user:
```env
DATABASE_URL="postgresql://sw_user:your_password@localhost:5432/sw_inventory?schema=public"
```

### Run Migrations

```bash
# Push the schema to your database
npx prisma db push

# Optional: Open Prisma Studio to view your database
npx prisma studio
```

---

## Option 2: Docker Compose (Easiest!)

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: sw_inventory_db
    environment:
      POSTGRES_USER: sw_user
      POSTGRES_PASSWORD: sw_password
      POSTGRES_DB: sw_inventory
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sw_user -d sw_inventory"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Start Database

```bash
# Start PostgreSQL container
docker-compose up -d

# Check if running
docker-compose ps

# View logs
docker-compose logs -f postgres
```

### Update .env

```env
DATABASE_URL="postgresql://sw_user:sw_password@localhost:5432/sw_inventory?schema=public"
```

### Run Migrations

```bash
npx prisma db push
```

---

## Option 3: Cloud PostgreSQL (For Production)

### Supabase (Free Tier Available)

1. Create account at https://supabase.com
2. Create new project
3. Copy connection string from Settings → Database
4. Update `.env` with your connection string:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres"
```

### Neon (Serverless PostgreSQL)

1. Create account at https://neon.tech
2. Create new project
3. Copy connection string
4. Update `.env`

### Railway

1. Create account at https://railway.app
2. New Project → Add PostgreSQL
3. Copy connection string from Variables tab
4. Update `.env`

---

## Verify Database Connection

After setting up, verify everything works:

```bash
# Test connection
npx prisma db pull

# View your database in browser
npx prisma studio
```

This should open Prisma Studio at http://localhost:5555

---

## Database Schema Overview

Your database has these tables:

### Core Tables
- **customers** - Multi-tenant customer information
- **vendors** - Software vendors
- **software** - Software products with versions
- **packages** - Software package releases
- **package_items** - Software items in packages
- **lpars** - Logical partitions
- **lpar_software** - Software installed on LPARs
- **audit_log** - Change tracking

### Key Features
- ✅ UUID primary keys
- ✅ JSONB for version history
- ✅ Foreign key constraints
- ✅ Indexes for performance
- ✅ Cascade and restrict delete rules
- ✅ Automatic timestamps

---

## Seed Sample Data (Optional)

Create a seed file to add sample data:

```bash
# Create seed script
touch prisma/seed.ts
```

Add to `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create a vendor
  const vendor = await prisma.vendor.create({
    data: {
      name: 'IBM',
      code: 'IBM',
      website: 'https://www.ibm.com',
      contactEmail: 'support@ibm.com',
      active: true
    }
  });

  // Create a customer
  const customer = await prisma.customer.create({
    data: {
      name: 'Acme Corporation',
      code: 'ACME',
      description: 'Sample customer for testing',
      active: true
    }
  });

  // Create software
  const software = await prisma.software.create({
    data: {
      name: 'CICS Transaction Server',
      vendorId: vendor.id,
      description: 'Enterprise transaction processing',
      currentVersion: 'V5R6M0',
      currentPtfLevel: 'PTF12345',
      versionHistory: [],
      active: true
    }
  });

  // Create package
  const pkg = await prisma.package.create({
    data: {
      name: 'Mainframe Suite Q1 2025',
      code: 'MF-Q1-2025',
      version: '2025.1.0',
      description: 'Q1 2025 mainframe software package',
      releaseDate: new Date('2025-01-15'),
      active: true,
      items: {
        create: [
          {
            softwareId: software.id,
            version: 'V5R6M0',
            ptfLevel: 'PTF12345',
            required: true,
            orderIndex: 1
          }
        ]
      }
    }
  });

  // Create LPAR
  const lpar = await prisma.lpar.create({
    data: {
      name: 'Production LPAR 1',
      code: 'PROD-LPAR-1',
      customerId: customer.id,
      description: 'Primary production LPAR',
      currentPackageId: pkg.id,
      active: true,
      softwareInstalled: {
        create: [
          {
            softwareId: software.id,
            currentVersion: 'V5R6M0',
            currentPtfLevel: 'PTF12345',
            installedDate: new Date(),
            rolledBack: false
          }
        ]
      }
    }
  });

  console.log('✅ Seed data created successfully!');
  console.log({ vendor, customer, software, pkg, lpar });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Update `package.json` to add seed script:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Install tsx and run seed:

```bash
npm install -D tsx
npx prisma db seed
```

---

## Common Prisma Commands

```bash
# Push schema changes to database
npx prisma db push

# Generate Prisma Client (after schema changes)
npx prisma generate

# Open database browser
npx prisma studio

# Create a migration (for production)
npx prisma migrate dev --name init

# Format your schema file
npx prisma format

# Validate schema
npx prisma validate

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

---

## Application is Ready!

Once your database is running:

1. **Start the dev server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   ```
   http://localhost:5173
   ```

3. **Create your first customer**:
   - Go to /customers
   - Click "Add Customer"
   - Fill out the form
   - Submit!

The data will be **saved to your PostgreSQL database** automatically! 🎉

---

## Database Features in Your App

### Automatic Features
- ✅ **Pagination** - All list pages support pagination
- ✅ **Search** - Search customers, vendors, software by name/code
- ✅ **Sorting** - Sort by any column
- ✅ **Relations** - Automatic joins for related data
- ✅ **Validation** - Zod schemas validate before database insert
- ✅ **Audit Logging** - All creates tracked in audit_log table
- ✅ **Soft Deletes** - Uses active flag instead of deleting

### Implemented Query Features
- Case-insensitive search
- Efficient pagination with counts
- Nested relations (LPAR → Customer → Package → Items)
- Transaction support (via Prisma)
- Connection pooling (built-in)

---

## Troubleshooting

### "Can't reach database server"
```bash
# Check if PostgreSQL is running
# Windows:
services.msc  # Look for PostgreSQL service

# Mac/Linux:
ps aux | grep postgres

# Docker:
docker ps
```

### "Port 5432 already in use"
```bash
# Check what's using the port
# Windows:
netstat -ano | findstr :5432

# Mac/Linux:
lsof -i :5432

# Change port in DATABASE_URL or stop other PostgreSQL instance
```

### "Schema out of sync"
```bash
# Reset and push again
npx prisma db push --force-reset
```

### "Prisma Client not generated"
```bash
npx prisma generate
```

---

## Next Steps

Now that PostgreSQL is integrated:

1. **Add More Routes** - Create edit/delete pages for entities
2. **Add Authentication** - Implement user login/permissions
3. **Add Validation** - Enhance form validation
4. **Add Search Filters** - Add advanced filtering options
5. **Add Reports** - Create dashboard with statistics
6. **Add API Routes** - Build REST API in `src/routes/api/`

---

## Performance Tips

### Indexes
The schema already includes indexes on:
- Foreign keys
- Search fields (name, code)
- Active status
- Timestamps

### Connection Pooling
For production, use PgBouncer or Prisma Accelerate:

```env
# With connection pooling
DATABASE_URL="postgresql://user:pass@host:5432/db"
DIRECT_URL="postgresql://user:pass@host:5432/db"  # For migrations
```

### Query Optimization
```typescript
// ✅ Good: Select only needed fields
const customers = await db.customer.findMany({
  select: { id: true, name: true, code: true }
});

// ❌ Bad: Select everything
const customers = await db.customer.findMany();
```

---

## Support

- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Your Schema**: [prisma/schema.prisma](prisma/schema.prisma)
- **Your DB Utils**: [src/lib/server/db.ts](src/lib/server/db.ts)

Happy coding! 🚀
