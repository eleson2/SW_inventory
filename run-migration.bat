@echo off
echo Running database migration to remove 'required' field...
echo.

echo Step 1: Dropping materialized view lpar_dashboard...
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -c "DROP MATERIALIZED VIEW IF EXISTS lpar_dashboard CASCADE;"

echo.
echo Step 2: Dropping view lpar_package_compliance...
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -c "DROP VIEW IF EXISTS lpar_package_compliance CASCADE;"

echo.
echo Step 3: Dropping required column from package_items...
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -c "ALTER TABLE package_items DROP COLUMN IF EXISTS required;"

echo.
echo Step 4: Recreating views from SQL file...
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -f "prisma\migrations\add_views_and_functions.sql"

echo.
echo Migration complete!
echo.
echo Verifying the column was removed...
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'package_items' AND column_name = 'required';"

pause
