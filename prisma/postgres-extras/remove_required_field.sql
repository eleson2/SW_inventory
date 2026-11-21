-- Migration: Remove 'required' field from package_items table
-- Date: 2025-11-12
-- Description: The 'required' field is no longer needed as all software items
--              in a package are considered necessary for deployment.

-- Drop the 'required' column from package_items
ALTER TABLE package_items DROP COLUMN IF EXISTS required;

-- Update the lpar_package_compliance view to remove 'required' field references
-- This recreates the view without the required column
DROP VIEW IF EXISTS lpar_package_compliance CASCADE;

CREATE OR REPLACE VIEW lpar_package_compliance AS
WITH lpar_expected AS (
    -- What software SHOULD be installed based on package assignment
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
    -- What software IS actually installed
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
    -- Compliance flags
    CASE
        WHEN la.software_id IS NULL THEN 'MISSING'
        WHEN la.current_version != le.expected_version THEN 'VERSION_MISMATCH'
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 'PTF_MISMATCH'
        WHEN la.rolled_back = true THEN 'ROLLED_BACK'
        ELSE 'COMPLIANT'
    END AS compliance_status,
    -- Priority for sorting
    CASE
        WHEN la.software_id IS NULL THEN 1
        WHEN la.rolled_back = true THEN 2
        WHEN la.current_version != le.expected_version THEN 3
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 4
        ELSE 5
    END AS priority
FROM lpar_expected le
LEFT JOIN lpar_actual la ON le.lpar_id = la.lpar_id AND le.software_id = la.software_id;

COMMENT ON VIEW lpar_package_compliance IS 'Shows compliance status of each LPAR against its assigned package';

-- Update the check_package_deployment_impact function to remove 'required' field
DROP FUNCTION IF EXISTS check_package_deployment_impact(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION check_package_deployment_impact(
    p_lpar_id UUID,
    p_package_id UUID
)
RETURNS TABLE (
    software_id UUID,
    software_name VARCHAR(100),
    current_version VARCHAR(50),
    current_ptf_level VARCHAR(50),
    new_version VARCHAR(50),
    new_ptf_level VARCHAR(50),
    change_type VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH package_software AS (
        -- Software in the new package
        SELECT
            pi.software_id,
            s.name AS software_name,
            sv.version AS pkg_version,
            sv.ptf_level AS pkg_ptf_level
        FROM package_items pi
        INNER JOIN software s ON pi.software_id = s.id
        INNER JOIN software_versions sv ON pi.software_version_id = sv.id
        WHERE pi.package_id = p_package_id
    ),
    current_software AS (
        -- Currently installed software
        SELECT
            ls.software_id,
            ls.current_version,
            ls.current_ptf_level
        FROM lpar_software ls
        WHERE ls.lpar_id = p_lpar_id
    )
    SELECT
        COALESCE(ps.software_id, cs.software_id),
        ps.software_name,
        cs.current_version,
        cs.current_ptf_level,
        ps.pkg_version,
        ps.pkg_ptf_level,
        CASE
            WHEN cs.software_id IS NULL THEN 'INSTALL'::VARCHAR(20)
            WHEN ps.software_id IS NULL THEN 'REMOVE'::VARCHAR(20)
            WHEN cs.current_version != ps.pkg_version OR
                 COALESCE(cs.current_ptf_level, '') != COALESCE(ps.pkg_ptf_level, '')
            THEN 'UPGRADE'::VARCHAR(20)
            ELSE 'NO_CHANGE'::VARCHAR(20)
        END
    FROM package_software ps
    FULL OUTER JOIN current_software cs ON ps.software_id = cs.software_id
    WHERE ps.software_id IS NOT NULL OR cs.software_id IS NOT NULL
    ORDER BY
        CASE
            WHEN cs.software_id IS NULL THEN 1
            WHEN ps.software_id IS NULL THEN 3
            ELSE 2
        END,
        ps.software_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION check_package_deployment_impact IS 'Simulates package deployment showing what would change (install/upgrade/remove)';
