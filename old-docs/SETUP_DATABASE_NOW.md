# 🔧 Create PostgreSQL Database - Quick Steps

## The Issue

The database `sw_inventory` needs to be created in your PostgreSQL installation. The schema push succeeded, but we need to create the database first.

---

## ✅ Quick Fix (Choose One Method)

### Method 1: Using pgAdmin (Easiest - GUI)

1. **Open pgAdmin 4** (should be installed with PostgreSQL)
   - Look in Start Menu → PostgreSQL 18 → pgAdmin 4

2. **Connect to PostgreSQL**
   - Expand "Servers" in the left panel
   - Right-click "PostgreSQL 18" → Connect
   - Enter your postgres password

3. **Create Database**
   - Right-click "Databases"
   - Select "Create" → "Database..."
   - Database name: `sw_inventory`
   - Owner: `postgres`
   - Click "Save"

4. **Done!** - Refresh your browser at http://localhost:5173

---

### Method 2: Using Command Line

1. **Open PowerShell as Administrator**

2. **Run this command** (enter your postgres password when prompted):
   ```powershell
   & "I:\Program Files\PostgreSQL\18\bin\createdb" -U postgres sw_inventory
   ```

3. **Or use psql**:
   ```powershell
   & "I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -c "CREATE DATABASE sw_inventory;"
   ```

4. **Done!** - Refresh your browser

---

### Method 3: Using SQL Shell (psql)

1. **Open SQL Shell (psql)** from Start Menu
   - PostgreSQL 18 → SQL Shell (psql)

2. **Press Enter** for defaults until Password prompt

3. **Enter your postgres password**

4. **Run this SQL**:
   ```sql
   CREATE DATABASE sw_inventory;
   \q
   ```

5. **Done!** - Refresh your browser

---

## After Creating the Database

### Run the Schema Migration

```bash
cd d:\proj\SW_inventory\SW_inventory
npx prisma db push
```

This will create all the tables.

### Seed the Data

```bash
npx prisma db seed
```

This will add the sample data.

### Restart Dev Server

```bash
# Press Ctrl+C to stop current server
npm run dev
```

---

## Verify It Works

1. **Open Prisma Studio**:
   ```bash
   npx prisma studio
   ```
   Go to http://localhost:5556

2. **Open Your App**:
   Go to http://localhost:5173

3. **Test**:
   - Go to /customers
   - Should see Acme and Globex
   - No more errors!

---

## What Went Wrong?

PostgreSQL requires explicit database creation before tables can be added. The `prisma db push` command creates tables *in* a database, but doesn't create the database itself.

This is a one-time setup. Once the database exists, everything will work perfectly!

---

## Quick Commands Summary

```powershell
# Create database (one of these):
& "I:\Program Files\PostgreSQL\18\bin\createdb" -U postgres sw_inventory

# Push schema
npx prisma db push

# Seed data
npx prisma db seed

# Start app
npm run dev
```

---

## Need Help?

1. **Find your postgres password** - It was set when you installed PostgreSQL
2. **Can't remember password?** - You may need to reset it or reinstall PostgreSQL
3. **pgAdmin not found?** - Install from https://www.pgadmin.org/download/

---

**Once the database is created, everything else is already configured and ready to go!** 🚀
