-- ============================================================================
-- RESET SCRIPT - Empty all tables
-- ============================================================================
-- Purpose: Remove all data from tables while preserving schema and views
-- Use Case: Clean slate for testing, preparing for production data load
-- WARNING: This will DELETE ALL DATA - use with caution!
-- ============================================================================

-- Disable foreign key checks temporarily for faster truncation
SET session_replication_role = 'replica';

-- Truncate all tables in dependency order (children first, parents last)
-- This ensures no foreign key violations

TRUNCATE TABLE audit_log CASCADE;
TRUNCATE TABLE lpar_software CASCADE;
TRUNCATE TABLE package_items CASCADE;
TRUNCATE TABLE lpars CASCADE;
TRUNCATE TABLE packages CASCADE;
TRUNCATE TABLE software_versions CASCADE;
TRUNCATE TABLE software CASCADE;
TRUNCATE TABLE customers CASCADE;
TRUNCATE TABLE vendors CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Reset sequences (if using SERIAL instead of UUID, this would matter)
-- For UUID-based tables, this doesn't reset the UUID generation

-- Refresh materialized view to clear dashboard data
REFRESH MATERIALIZED VIEW lpar_dashboard;

-- Report success
DO $$
BEGIN
    RAISE NOTICE '✅ All tables have been emptied successfully';
    RAISE NOTICE 'Tables affected:';
    RAISE NOTICE '  - vendors';
    RAISE NOTICE '  - customers';
    RAISE NOTICE '  - software';
    RAISE NOTICE '  - software_versions';
    RAISE NOTICE '  - packages';
    RAISE NOTICE '  - package_items';
    RAISE NOTICE '  - lpars';
    RAISE NOTICE '  - lpar_software';
    RAISE NOTICE '  - audit_log';
    RAISE NOTICE '';
    RAISE NOTICE 'Materialized view refreshed: lpar_dashboard';
    RAISE NOTICE '';
    RAISE NOTICE 'Schema, views, and functions remain intact';
END $$;
