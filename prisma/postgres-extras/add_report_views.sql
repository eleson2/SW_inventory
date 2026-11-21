-- Report Views for Software Inventory System
-- These views support common reporting queries

-- Software Per Customer Report
-- Shows what software and versions are installed on customer LPARs
-- Includes count of LPARs with each software/version combination
CREATE OR REPLACE VIEW software_per_customer AS
SELECT
    c.id as customer_id,
    c.name as customer_name,
    c.code as customer_code,
    s.id as software_id,
    s.name as software_name,
    v.name as vendor_name,
    v.code as vendor_code,
    ls.current_version as version,
    ls.current_ptf_level as ptf_level,
    sv.release_date,
    COUNT(DISTINCT l.id) as lpar_count,
    ARRAY_AGG(DISTINCT l.name ORDER BY l.name) as lpar_names,
    ARRAY_AGG(DISTINCT l.code ORDER BY l.code) as lpar_codes,
    MAX(ls.installed_date) as latest_install_date,
    -- Flag if any LPAR has rolled back this software
    BOOL_OR(ls.rolled_back) as has_rollbacks
FROM customers c
INNER JOIN lpars l ON l.customer_id = c.id AND l.active = true
INNER JOIN lpar_software ls ON ls.lpar_id = l.id
INNER JOIN software s ON s.id = ls.software_id AND s.active = true
INNER JOIN vendors v ON v.id = s.vendor_id AND v.active = true
LEFT JOIN software_versions sv ON sv.software_id = s.id
    AND sv.version = ls.current_version
    AND (sv.ptf_level = ls.current_ptf_level OR (sv.ptf_level IS NULL AND ls.current_ptf_level IS NULL))
WHERE c.active = true
GROUP BY
    c.id, c.name, c.code,
    s.id, s.name,
    v.name, v.code,
    ls.current_version, ls.current_ptf_level, sv.release_date
ORDER BY
    c.name,
    s.name,
    sv.release_date DESC;

-- Add comment explaining the view
COMMENT ON VIEW software_per_customer IS
'Aggregates software installations by customer. Shows software name, version, and count of LPARs it is installed on. Useful for customer software inventory reports.';
