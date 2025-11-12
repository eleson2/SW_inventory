-- Simple migration to remove required field
-- Step 1: Drop dependent views
DROP MATERIALIZED VIEW IF EXISTS lpar_dashboard CASCADE;
DROP VIEW IF EXISTS lpar_package_compliance CASCADE;

-- Step 2: Drop the required column
ALTER TABLE package_items DROP COLUMN IF EXISTS required;

-- Step 3: Recreate lpar_package_compliance view without required field
CREATE OR REPLACE VIEW lpar_package_compliance AS
WITH lpar_expected AS (
    SELECT
        l.id AS lpar_id,
        l.name AS lpar_name,
        l.code AS lpar_code,
        l.customer_id,
        c.name AS customer_name,
        p.id AS package_id,
        p.name AS package_name,
        p.version AS package_version,
        pi.software_id,
        s.name AS software_name,
        sv.version AS expected_version,
        sv.ptf_level AS expected_ptf_level,
        pi.order_index
    FROM lpars l
    INNER JOIN customers c ON l.customer_id = c.id
    LEFT JOIN packages p ON l.current_package_id = p.id
    LEFT JOIN package_items pi ON p.id = pi.package_id
    LEFT JOIN software s ON pi.software_id = s.id
    LEFT JOIN software_versions sv ON pi.software_version_id = sv.id
    WHERE l.active = true
),
lpar_actual AS (
    SELECT
        ls.lpar_id,
        ls.software_id,
        ls.current_version,
        ls.current_ptf_level,
        ls.rolled_back,
        ls.installed_date
    FROM lpar_software ls
)
SELECT
    le.lpar_id,
    le.lpar_name,
    le.lpar_code,
    le.customer_id,
    le.customer_name,
    le.package_id,
    le.package_name,
    le.package_version,
    le.software_id,
    le.software_name,
    le.expected_version,
    le.expected_ptf_level,
    la.current_version AS installed_version,
    la.current_ptf_level AS installed_ptf_level,
    la.rolled_back,
    la.installed_date,
    CASE
        WHEN la.software_id IS NULL THEN 'MISSING'
        WHEN la.current_version != le.expected_version THEN 'VERSION_MISMATCH'
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 'PTF_MISMATCH'
        WHEN la.rolled_back = true THEN 'ROLLED_BACK'
        ELSE 'COMPLIANT'
    END AS compliance_status,
    CASE
        WHEN la.software_id IS NULL THEN 1
        WHEN la.rolled_back = true THEN 2
        WHEN la.current_version != le.expected_version THEN 3
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 4
        ELSE 5
    END AS priority
FROM lpar_expected le
LEFT JOIN lpar_actual la ON le.lpar_id = la.lpar_id AND le.software_id = la.software_id;
