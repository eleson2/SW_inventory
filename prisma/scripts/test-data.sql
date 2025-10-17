-- ============================================================================
-- TEST DATA SCRIPT - Load sample data for development and testing
-- ============================================================================
-- Purpose: Populate database with realistic test data
-- Use Case: Development, testing, demos
-- Prerequisites: Empty tables (run reset.sql first if needed)
-- ============================================================================

-- ============================================================================
-- VENDORS
-- ============================================================================

INSERT INTO vendors (id, name, code, website, contact_email, active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'IBM', 'IBM', 'https://www.ibm.com', 'support@ibm.com', true, NOW(), NOW()),
    (gen_random_uuid(), 'Broadcom', 'BROADCOM', 'https://www.broadcom.com', 'support@broadcom.com', true, NOW(), NOW());

-- Store vendor IDs for later use
DO $$
DECLARE
    v_ibm_id UUID;
    v_broadcom_id UUID;
BEGIN
    SELECT id INTO v_ibm_id FROM vendors WHERE code = 'IBM';
    SELECT id INTO v_broadcom_id FROM vendors WHERE code = 'BROADCOM';

    -- Create temporary table to store IDs for this session
    CREATE TEMP TABLE temp_ids (
        ibm_id UUID,
        broadcom_id UUID,
        acme_id UUID,
        globex_id UUID,
        cics_id UUID,
        db2_id UUID,
        endevor_id UUID,
        cics_v5r4m0_id UUID,
        cics_v5r5m0_id UUID,
        cics_v5r6m0_id UUID,
        db2_v12r1m0_id UUID,
        db2_v13r1m0_id UUID,
        endevor_v18r1m0_id UUID,
        endevor_v18r2m0_id UUID,
        package_2025q1_id UUID,
        package_2024q4_id UUID,
        prod_lpar1_id UUID,
        test_lpar1_id UUID,
        globex_prod_id UUID
    );

    INSERT INTO temp_ids (ibm_id, broadcom_id)
    VALUES (v_ibm_id, v_broadcom_id);
END $$;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

INSERT INTO customers (id, name, code, description, active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Acme Corporation', 'ACME', 'Large manufacturing company', true, NOW(), NOW()),
    (gen_random_uuid(), 'Globex Industries', 'GLOBEX', 'International conglomerate', true, NOW(), NOW());

-- Store customer IDs
DO $$
DECLARE
    v_acme_id UUID;
    v_globex_id UUID;
BEGIN
    SELECT id INTO v_acme_id FROM customers WHERE code = 'ACME';
    SELECT id INTO v_globex_id FROM customers WHERE code = 'GLOBEX';

    UPDATE temp_ids SET acme_id = v_acme_id, globex_id = v_globex_id;
END $$;

-- ============================================================================
-- SOFTWARE
-- ============================================================================

INSERT INTO software (id, name, vendor_id, description, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'CICS Transaction Server',
    ibm_id,
    'Enterprise transaction processing system',
    true,
    NOW(),
    NOW()
FROM temp_ids;

INSERT INTO software (id, name, vendor_id, description, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'DB2 for z/OS',
    ibm_id,
    'Relational database management system',
    true,
    NOW(),
    NOW()
FROM temp_ids;

INSERT INTO software (id, name, vendor_id, description, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Endevor',
    broadcom_id,
    'Software change management system',
    true,
    NOW(),
    NOW()
FROM temp_ids;

-- Store software IDs
DO $$
DECLARE
    v_cics_id UUID;
    v_db2_id UUID;
    v_endevor_id UUID;
BEGIN
    SELECT id INTO v_cics_id FROM software WHERE name = 'CICS Transaction Server';
    SELECT id INTO v_db2_id FROM software WHERE name = 'DB2 for z/OS';
    SELECT id INTO v_endevor_id FROM software WHERE name = 'Endevor';

    UPDATE temp_ids SET cics_id = v_cics_id, db2_id = v_db2_id, endevor_id = v_endevor_id;
END $$;

-- ============================================================================
-- SOFTWARE VERSIONS
-- ============================================================================

-- CICS Versions
INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    cics_id,
    'V5R4M0',
    'PTF10000',
    '2023-03-01'::DATE,
    'CICS TS 5.4 - Baseline release',
    false,
    NOW()
FROM temp_ids;

INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    cics_id,
    'V5R5M0',
    'PTF11111',
    '2024-06-15'::DATE,
    'CICS TS 5.5 - Enhanced security features',
    false,
    NOW()
FROM temp_ids;

INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    cics_id,
    'V5R6M0',
    'PTF12345',
    '2025-01-10'::DATE,
    'CICS TS 5.6 - Performance improvements and cloud integration',
    true,
    NOW()
FROM temp_ids;

-- DB2 Versions
INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    db2_id,
    'V12R1M0',
    'PTF50000',
    '2023-09-01'::DATE,
    'DB2 12 - Baseline release',
    false,
    NOW()
FROM temp_ids;

INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    db2_id,
    'V13R1M0',
    'PTF54321',
    '2025-01-05'::DATE,
    'DB2 13 - AI-powered query optimization',
    true,
    NOW()
FROM temp_ids;

-- Endevor Versions
INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    endevor_id,
    'V18R1M0',
    'SO11111',
    '2024-04-01'::DATE,
    'Endevor 18.1 - DevOps integration',
    false,
    NOW()
FROM temp_ids;

INSERT INTO software_versions (id, software_id, version, ptf_level, release_date, release_notes, is_current, created_at)
SELECT
    gen_random_uuid(),
    endevor_id,
    'V18R2M0',
    'SO12345',
    '2025-01-08'::DATE,
    'Endevor 18.2 - Enhanced Git bridge and API improvements',
    true,
    NOW()
FROM temp_ids;

-- Store version IDs
DO $$
DECLARE
    v_cics_v5r4m0_id UUID;
    v_cics_v5r5m0_id UUID;
    v_cics_v5r6m0_id UUID;
    v_db2_v12r1m0_id UUID;
    v_db2_v13r1m0_id UUID;
    v_endevor_v18r1m0_id UUID;
    v_endevor_v18r2m0_id UUID;
BEGIN
    SELECT id INTO v_cics_v5r4m0_id FROM software_versions WHERE version = 'V5R4M0' AND ptf_level = 'PTF10000';
    SELECT id INTO v_cics_v5r5m0_id FROM software_versions WHERE version = 'V5R5M0' AND ptf_level = 'PTF11111';
    SELECT id INTO v_cics_v5r6m0_id FROM software_versions WHERE version = 'V5R6M0' AND ptf_level = 'PTF12345';
    SELECT id INTO v_db2_v12r1m0_id FROM software_versions WHERE version = 'V12R1M0' AND ptf_level = 'PTF50000';
    SELECT id INTO v_db2_v13r1m0_id FROM software_versions WHERE version = 'V13R1M0' AND ptf_level = 'PTF54321';
    SELECT id INTO v_endevor_v18r1m0_id FROM software_versions WHERE version = 'V18R1M0' AND ptf_level = 'SO11111';
    SELECT id INTO v_endevor_v18r2m0_id FROM software_versions WHERE version = 'V18R2M0' AND ptf_level = 'SO12345';

    UPDATE temp_ids SET
        cics_v5r4m0_id = v_cics_v5r4m0_id,
        cics_v5r5m0_id = v_cics_v5r5m0_id,
        cics_v5r6m0_id = v_cics_v5r6m0_id,
        db2_v12r1m0_id = v_db2_v12r1m0_id,
        db2_v13r1m0_id = v_db2_v13r1m0_id,
        endevor_v18r1m0_id = v_endevor_v18r1m0_id,
        endevor_v18r2m0_id = v_endevor_v18r2m0_id;
END $$;

-- Update software to point to current versions
UPDATE software s
SET current_version_id = t.cics_v5r6m0_id
FROM temp_ids t
WHERE s.name = 'CICS Transaction Server';

UPDATE software s
SET current_version_id = t.db2_v13r1m0_id
FROM temp_ids t
WHERE s.name = 'DB2 for z/OS';

UPDATE software s
SET current_version_id = t.endevor_v18r2m0_id
FROM temp_ids t
WHERE s.name = 'Endevor';

-- ============================================================================
-- PACKAGES
-- ============================================================================

INSERT INTO packages (id, name, code, version, description, release_date, active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Mainframe Suite Q1 2025', 'MF-Q1-2025', '2025.1.0', 'Q1 2025 mainframe software package release', '2025-01-15'::DATE, true, NOW(), NOW()),
    (gen_random_uuid(), 'Mainframe Suite Q4 2024', 'MF-Q4-2024', '2024.4.0', 'Q4 2024 mainframe software package release', '2024-10-01'::DATE, true, NOW(), NOW());

-- Store package IDs
DO $$
DECLARE
    v_package_2025q1_id UUID;
    v_package_2024q4_id UUID;
BEGIN
    SELECT id INTO v_package_2025q1_id FROM packages WHERE code = 'MF-Q1-2025';
    SELECT id INTO v_package_2024q4_id FROM packages WHERE code = 'MF-Q4-2024';

    UPDATE temp_ids SET package_2025q1_id = v_package_2025q1_id, package_2024q4_id = v_package_2024q4_id;
END $$;

-- ============================================================================
-- PACKAGE ITEMS
-- ============================================================================

-- Package 2025 Q1 Items
INSERT INTO package_items (id, package_id, software_id, software_version_id, required, order_index, created_at)
SELECT
    gen_random_uuid(),
    package_2025q1_id,
    cics_id,
    cics_v5r6m0_id,
    true,
    1,
    NOW()
FROM temp_ids;

INSERT INTO package_items (id, package_id, software_id, software_version_id, required, order_index, created_at)
SELECT
    gen_random_uuid(),
    package_2025q1_id,
    db2_id,
    db2_v13r1m0_id,
    true,
    2,
    NOW()
FROM temp_ids;

INSERT INTO package_items (id, package_id, software_id, software_version_id, required, order_index, created_at)
SELECT
    gen_random_uuid(),
    package_2025q1_id,
    endevor_id,
    endevor_v18r2m0_id,
    false,
    3,
    NOW()
FROM temp_ids;

-- Package 2024 Q4 Items
INSERT INTO package_items (id, package_id, software_id, software_version_id, required, order_index, created_at)
SELECT
    gen_random_uuid(),
    package_2024q4_id,
    cics_id,
    cics_v5r5m0_id,
    true,
    1,
    NOW()
FROM temp_ids;

INSERT INTO package_items (id, package_id, software_id, software_version_id, required, order_index, created_at)
SELECT
    gen_random_uuid(),
    package_2024q4_id,
    db2_id,
    db2_v12r1m0_id,
    true,
    2,
    NOW()
FROM temp_ids;

-- ============================================================================
-- LPARS
-- ============================================================================

INSERT INTO lpars (id, name, code, customer_id, description, current_package_id, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Production LPAR 1',
    'PROD-LPAR-1',
    acme_id,
    'Primary production LPAR for Acme Corporation',
    package_2025q1_id,
    true,
    NOW(),
    NOW()
FROM temp_ids;

INSERT INTO lpars (id, name, code, customer_id, description, current_package_id, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Test LPAR 1',
    'TEST-LPAR-1',
    acme_id,
    'Test environment for Acme Corporation',
    package_2024q4_id,
    true,
    NOW(),
    NOW()
FROM temp_ids;

INSERT INTO lpars (id, name, code, customer_id, description, current_package_id, active, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'Globex Production',
    'GLOBEX-PROD',
    globex_id,
    'Production LPAR for Globex Industries',
    package_2025q1_id,
    true,
    NOW(),
    NOW()
FROM temp_ids;

-- Store LPAR IDs
DO $$
DECLARE
    v_prod_lpar1_id UUID;
    v_test_lpar1_id UUID;
    v_globex_prod_id UUID;
BEGIN
    SELECT id INTO v_prod_lpar1_id FROM lpars WHERE code = 'PROD-LPAR-1';
    SELECT id INTO v_test_lpar1_id FROM lpars WHERE code = 'TEST-LPAR-1';
    SELECT id INTO v_globex_prod_id FROM lpars WHERE code = 'GLOBEX-PROD';

    UPDATE temp_ids SET prod_lpar1_id = v_prod_lpar1_id, test_lpar1_id = v_test_lpar1_id, globex_prod_id = v_globex_prod_id;
END $$;

-- ============================================================================
-- LPAR SOFTWARE
-- ============================================================================

-- Production LPAR 1 Software
INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, previous_version, previous_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    prod_lpar1_id,
    cics_id,
    'V5R6M0',
    'PTF12345',
    'V5R5M0',
    'PTF11111',
    '2025-01-20'::TIMESTAMP,
    false
FROM temp_ids;

INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, previous_version, previous_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    prod_lpar1_id,
    db2_id,
    'V13R1M0',
    'PTF54321',
    'V12R1M0',
    'PTF50000',
    '2025-01-20'::TIMESTAMP,
    false
FROM temp_ids;

INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    prod_lpar1_id,
    endevor_id,
    'V18R2M0',
    'SO12345',
    '2025-01-22'::TIMESTAMP,
    false
FROM temp_ids;

-- Test LPAR 1 Software
INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    test_lpar1_id,
    cics_id,
    'V5R5M0',
    'PTF11111',
    '2024-10-15'::TIMESTAMP,
    false
FROM temp_ids;

INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    test_lpar1_id,
    db2_id,
    'V12R1M0',
    'PTF50000',
    '2024-10-15'::TIMESTAMP,
    false
FROM temp_ids;

-- Globex Production Software
INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    globex_prod_id,
    cics_id,
    'V5R6M0',
    'PTF12345',
    '2025-01-25'::TIMESTAMP,
    false
FROM temp_ids;

INSERT INTO lpar_software (id, lpar_id, software_id, current_version, current_ptf_level, installed_date, rolled_back)
SELECT
    gen_random_uuid(),
    globex_prod_id,
    db2_id,
    'V13R1M0',
    'PTF54321',
    '2025-01-25'::TIMESTAMP,
    false
FROM temp_ids;

-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

INSERT INTO audit_log (id, entity_type, entity_id, action, changes, timestamp)
SELECT
    gen_random_uuid(),
    'lpar',
    prod_lpar1_id,
    'create',
    jsonb_build_object(
        'name', 'Production LPAR 1',
        'code', 'PROD-LPAR-1',
        'customerId', acme_id
    ),
    NOW()
FROM temp_ids;

INSERT INTO audit_log (id, entity_type, entity_id, action, changes, timestamp)
SELECT
    gen_random_uuid(),
    'lpar',
    prod_lpar1_id,
    'update',
    jsonb_build_object(
        'before', jsonb_build_object('packageId', package_2024q4_id),
        'after', jsonb_build_object('packageId', package_2025q1_id)
    ),
    '2025-01-20'::TIMESTAMP
FROM temp_ids;

-- ============================================================================
-- REFRESH MATERIALIZED VIEW
-- ============================================================================

REFRESH MATERIALIZED VIEW lpar_dashboard;

-- ============================================================================
-- CLEANUP AND REPORT
-- ============================================================================

-- Clean up temporary table
DROP TABLE IF EXISTS temp_ids;

-- Report success
DO $$
BEGIN
    RAISE NOTICE '✅ Test data loaded successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Summary:';
    RAISE NOTICE '   - % Vendors created', (SELECT COUNT(*) FROM vendors);
    RAISE NOTICE '   - % Customers created', (SELECT COUNT(*) FROM customers);
    RAISE NOTICE '   - % Software products created', (SELECT COUNT(*) FROM software);
    RAISE NOTICE '   - % Software versions created', (SELECT COUNT(*) FROM software_versions);
    RAISE NOTICE '   - % Packages created', (SELECT COUNT(*) FROM packages);
    RAISE NOTICE '   - % Package items created', (SELECT COUNT(*) FROM package_items);
    RAISE NOTICE '   - % LPARs created', (SELECT COUNT(*) FROM lpars);
    RAISE NOTICE '   - % LPAR software installations', (SELECT COUNT(*) FROM lpar_software);
    RAISE NOTICE '   - % Audit log entries created', (SELECT COUNT(*) FROM audit_log);
    RAISE NOTICE '';
    RAISE NOTICE 'Materialized view refreshed: lpar_dashboard';
END $$;
