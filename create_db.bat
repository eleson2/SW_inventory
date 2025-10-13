@echo off
echo Creating sw_inventory database in PostgreSQL...
"I:\Program Files\PostgreSQL\18\bin\createdb" -U postgres sw_inventory
if %ERRORLEVEL% EQU 0 (
    echo Database created successfully!
) else (
    echo Database might already exist or there was an error.
    echo Check if you need to enter the PostgreSQL password.
)
pause
