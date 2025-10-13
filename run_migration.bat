@echo off
echo Running performance enhancements migration...
set PGPASSWORD=postgres
"I:\Program Files\PostgreSQL\18\bin\psql" -U postgres -d sw_inventory -f prisma\migrations\performance_enhancements.sql
echo.
echo Migration completed!
pause
