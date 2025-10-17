-- ============================================================================
-- DATABASE VIEWS AND FUNCTIONS FOR SOFTWARE INVENTORY MANAGEMENT
-- ============================================================================

-- ----------------------------------------------------------------------------
-- VIEW: software_with_current_version
-- Purpose: Denormalized view of software with current version details
-- Use Case: Displaying software lists without manual joins
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW software_with_current_version AS
SELECT
    s.id AS software_id,
    s.name AS software_name,
    s.vendor_id,
    v.name AS vendor_name,
    v.code AS vendor_code,
    s.description,
    s.active,
    s.created_at,
    s.updated_at,
    sv.id AS current_version_id,
    sv.version AS current_version,
    sv.ptf_level AS current_ptf_level,
    sv.release_date AS current_version_release_date,
    sv.end_of_support AS current_version_end_of_support,
    sv.release_notes AS current_version_notes,
    -- Count of total versions for this software
    (SELECT COUNT(*) FROM software_versions WHERE software_id = s.id) AS total_versions
FROM software s
LEFT JOIN software_versions sv ON s.current_version_id = sv.id
LEFT JOIN vendors v ON s.vendor_id = v.id;

COMMENT ON VIEW software_with_current_version IS 'Denormalized view combining software with current version details and vendor info';

-- ----------------------------------------------------------------------------
-- VIEW: lpar_package_compliance
-- Purpose: Check if LPARs have all required software from their assigned package
-- Use Case: Compliance reporting, identifying out-of-sync LPARs
-- ----------------------------------------------------------------------------
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
        pi.required,
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
    le.required,
    la.current_version AS installed_version,
    la.current_ptf_level AS installed_ptf_level,
    la.rolled_back,
    la.installed_date,
    -- Compliance flags
    CASE
        WHEN la.software_id IS NULL AND le.required = true THEN 'MISSING_REQUIRED'
        WHEN la.software_id IS NULL AND le.required = false THEN 'MISSING_OPTIONAL'
        WHEN la.current_version != le.expected_version THEN 'VERSION_MISMATCH'
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 'PTF_MISMATCH'
        WHEN la.rolled_back = true THEN 'ROLLED_BACK'
        ELSE 'COMPLIANT'
    END AS compliance_status,
    -- Priority for sorting
    CASE
        WHEN la.software_id IS NULL AND le.required = true THEN 1
        WHEN la.rolled_back = true THEN 2
        WHEN la.current_version != le.expected_version THEN 3
        WHEN la.current_ptf_level != le.expected_ptf_level THEN 4
        ELSE 5
    END AS priority
FROM lpar_expected le
LEFT JOIN lpar_actual la ON le.lpar_id = la.lpar_id AND le.software_id = la.software_id;

COMMENT ON VIEW lpar_package_compliance IS 'Shows compliance status of each LPAR against its assigned package';

-- ----------------------------------------------------------------------------
-- VIEW: rollback_history
-- Purpose: Comprehensive rollback history with context
-- Use Case: Analyzing problem software, rollback frequency
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW rollback_history AS
SELECT
    ls.id AS lpar_software_id,
    l.id AS lpar_id,
    l.name AS lpar_name,
    l.code AS lpar_code,
    c.id AS customer_id,
    c.name AS customer_name,
    s.id AS software_id,
    s.name AS software_name,
    v.name AS vendor_name,
    ls.current_version,
    ls.current_ptf_level,
    ls.previous_version,
    ls.previous_ptf_level,
    ls.rolled_back,
    ls.rolled_back_at,
    ls.rollback_reason,
    ls.installed_date,
    -- Time to rollback (how long before issues found)
    EXTRACT(EPOCH FROM (ls.rolled_back_at - ls.installed_date)) / 3600 AS hours_until_rollback,
    -- Days since rollback
    EXTRACT(DAY FROM (NOW() - ls.rolled_back_at)) AS days_since_rollback
FROM lpar_software ls
INNER JOIN lpars l ON ls.lpar_id = l.id
INNER JOIN customers c ON l.customer_id = c.id
INNER JOIN software s ON ls.software_id = s.id
INNER JOIN vendors v ON s.vendor_id = v.id
WHERE ls.rolled_back = true
ORDER BY ls.rolled_back_at DESC;

COMMENT ON VIEW rollback_history IS 'Complete rollback history with timing analysis';

-- ----------------------------------------------------------------------------
-- VIEW: software_adoption_rate
-- Purpose: Track which versions are deployed across LPARs
-- Use Case: Understanding version adoption, planning upgrades
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW software_adoption_rate AS
WITH version_usage AS (
    SELECT
        ls.software_id,
        ls.current_version,
        ls.current_ptf_level,
        COUNT(DISTINCT ls.lpar_id) AS lpar_count,
        COUNT(DISTINCT l.customer_id) AS customer_count,
        SUM(CASE WHEN ls.rolled_back = true THEN 1 ELSE 0 END) AS rollback_count
    FROM lpar_software ls
    INNER JOIN lpars l ON ls.lpar_id = l.id
    WHERE l.active = true
    GROUP BY ls.software_id, ls.current_version, ls.current_ptf_level
),
total_lpars AS (
    SELECT
        s.id AS software_id,
        COUNT(DISTINCT ls.lpar_id) AS total_lpar_count
    FROM software s
    LEFT JOIN lpar_software ls ON s.id = ls.software_id
    INNER JOIN lpars l ON ls.lpar_id = l.id
    WHERE l.active = true
    GROUP BY s.id
)
SELECT
    s.id AS software_id,
    s.name AS software_name,
    v.name AS vendor_name,
    vu.current_version,
    vu.current_ptf_level,
    vu.lpar_count,
    vu.customer_count,
    vu.rollback_count,
    tl.total_lpar_count,
    ROUND(100.0 * vu.lpar_count / NULLIF(tl.total_lpar_count, 0), 2) AS adoption_percentage,
    -- Is this the current version?
    CASE WHEN sv.is_current = true THEN true ELSE false END AS is_current_version,
    sv.release_date AS version_release_date,
    -- Days since this version was released
    EXTRACT(DAY FROM (NOW() - sv.release_date)) AS days_since_release
FROM version_usage vu
INNER JOIN software s ON vu.software_id = s.id
INNER JOIN vendors v ON s.vendor_id = v.id
LEFT JOIN total_lpars tl ON s.id = tl.software_id
LEFT JOIN software_versions sv ON s.id = sv.software_id
    AND vu.current_version = sv.version
    AND (vu.current_ptf_level = sv.ptf_level OR (vu.current_ptf_level IS NULL AND sv.ptf_level IS NULL))
ORDER BY s.name, adoption_percentage DESC;

COMMENT ON VIEW software_adoption_rate IS 'Version adoption statistics across all LPARs';

-- ----------------------------------------------------------------------------
-- MATERIALIZED VIEW: lpar_dashboard
-- Purpose: High-performance dashboard data (refresh periodically)
-- Use Case: Dashboard UI, reporting
-- ----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW lpar_dashboard AS
SELECT
    l.id AS lpar_id,
    l.name AS lpar_name,
    l.code AS lpar_code,
    c.id AS customer_id,
    c.name AS customer_name,
    p.id AS package_id,
    p.name AS package_name,
    p.version AS package_version,
    l.active,
    l.updated_at AS last_updated,
    -- Software counts
    (SELECT COUNT(*) FROM lpar_software ls WHERE ls.lpar_id = l.id) AS software_count,
    (SELECT COUNT(*) FROM lpar_software ls WHERE ls.lpar_id = l.id AND ls.rolled_back = true) AS rollback_count,
    -- Compliance summary
    (SELECT COUNT(*)
     FROM lpar_package_compliance lpc
     WHERE lpc.lpar_id = l.id
       AND lpc.compliance_status = 'MISSING_REQUIRED') AS missing_required_count,
    (SELECT COUNT(*)
     FROM lpar_package_compliance lpc
     WHERE lpc.lpar_id = l.id
       AND lpc.compliance_status = 'VERSION_MISMATCH') AS version_mismatch_count,
    (SELECT COUNT(*)
     FROM lpar_package_compliance lpc
     WHERE lpc.lpar_id = l.id
       AND lpc.compliance_status = 'COMPLIANT') AS compliant_count,
    -- Overall health score (0-100)
    CASE
        WHEN (SELECT COUNT(*) FROM lpar_software ls WHERE ls.lpar_id = l.id) = 0 THEN 0
        ELSE ROUND(
            100.0 * (
                SELECT COUNT(*)
                FROM lpar_package_compliance lpc
                WHERE lpc.lpar_id = l.id AND lpc.compliance_status = 'COMPLIANT'
            ) / NULLIF(
                (SELECT COUNT(*) FROM lpar_package_compliance lpc WHERE lpc.lpar_id = l.id),
                0
            ),
            2
        )
    END AS health_score,
    -- Most recent install
    (SELECT MAX(ls.installed_date) FROM lpar_software ls WHERE ls.lpar_id = l.id) AS last_install_date,
    -- Most recent rollback
    (SELECT MAX(ls.rolled_back_at) FROM lpar_software ls WHERE ls.lpar_id = l.id AND ls.rolled_back = true) AS last_rollback_date
FROM lpars l
INNER JOIN customers c ON l.customer_id = c.id
LEFT JOIN packages p ON l.current_package_id = p.id
WHERE l.active = true;

-- Create index on materialized view for fast lookups
CREATE UNIQUE INDEX idx_lpar_dashboard_lpar_id ON lpar_dashboard(lpar_id);
CREATE INDEX idx_lpar_dashboard_customer_id ON lpar_dashboard(customer_id);
CREATE INDEX idx_lpar_dashboard_health_score ON lpar_dashboard(health_score);

COMMENT ON MATERIALIZED VIEW lpar_dashboard IS 'Pre-computed dashboard metrics for LPARs (refresh with: REFRESH MATERIALIZED VIEW lpar_dashboard)';

-- ----------------------------------------------------------------------------
-- FUNCTION: get_version_upgrade_path
-- Purpose: Find all versions between two versions for upgrade planning
-- Parameters:
--   p_software_id: UUID of software
--   p_from_version: Starting version
--   p_to_version: Target version
-- Returns: Table of versions in chronological order
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_version_upgrade_path(
    p_software_id UUID,
    p_from_version VARCHAR(50),
    p_to_version VARCHAR(50)
)
RETURNS TABLE (
    version_id UUID,
    version VARCHAR(50),
    ptf_level VARCHAR(50),
    release_date TIMESTAMP,
    release_notes TEXT,
    step_number INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH version_path AS (
        SELECT
            sv.id,
            sv.version,
            sv.ptf_level,
            sv.release_date,
            sv.release_notes,
            ROW_NUMBER() OVER (ORDER BY sv.release_date) AS step_num
        FROM software_versions sv
        WHERE sv.software_id = p_software_id
          AND sv.release_date >= (
              SELECT release_date FROM software_versions
              WHERE software_id = p_software_id AND version = p_from_version
              LIMIT 1
          )
          AND sv.release_date <= (
              SELECT release_date FROM software_versions
              WHERE software_id = p_software_id AND version = p_to_version
              LIMIT 1
          )
        ORDER BY sv.release_date
    )
    SELECT
        vp.id,
        vp.version,
        vp.ptf_level,
        vp.release_date,
        vp.release_notes,
        vp.step_num::INTEGER
    FROM version_path vp;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_version_upgrade_path IS 'Returns ordered list of versions between two versions for upgrade planning';

-- ----------------------------------------------------------------------------
-- FUNCTION: check_package_deployment_impact
-- Purpose: Simulate package deployment and show what would change
-- Parameters:
--   p_lpar_id: UUID of target LPAR
--   p_package_id: UUID of package to deploy
-- Returns: Table showing changes that would occur
-- ----------------------------------------------------------------------------
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
    change_type VARCHAR(20),
    required BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH package_software AS (
        -- Software in the new package
        SELECT
            pi.software_id,
            s.name AS software_name,
            sv.version AS pkg_version,
            sv.ptf_level AS pkg_ptf_level,
            pi.required
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
        END,
        ps.required
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

-- ----------------------------------------------------------------------------
-- FUNCTION: get_software_problem_score
-- Purpose: Calculate a "problem score" for software based on rollback history
-- Parameters:
--   p_software_id: UUID of software
--   p_days_lookback: Number of days to analyze (default 90)
-- Returns: Score from 0-100 (higher = more problems)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_software_problem_score(
    p_software_id UUID,
    p_days_lookback INTEGER DEFAULT 90
)
RETURNS TABLE (
    software_id UUID,
    software_name VARCHAR(100),
    total_installs INTEGER,
    rollback_count INTEGER,
    rollback_rate NUMERIC,
    avg_hours_to_rollback NUMERIC,
    problem_score INTEGER,
    risk_level VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    WITH install_stats AS (
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN ls.rolled_back = true THEN 1 ELSE 0 END) AS rollbacks,
            AVG(
                CASE WHEN ls.rolled_back = true
                THEN EXTRACT(EPOCH FROM (ls.rolled_back_at - ls.installed_date)) / 3600
                ELSE NULL END
            ) AS avg_hours
        FROM lpar_software ls
        WHERE ls.software_id = p_software_id
          AND ls.installed_date >= NOW() - (p_days_lookback || ' days')::INTERVAL
    )
    SELECT
        p_software_id,
        s.name,
        ist.total::INTEGER,
        ist.rollbacks::INTEGER,
        ROUND(100.0 * ist.rollbacks / NULLIF(ist.total, 0), 2),
        ROUND(ist.avg_hours::NUMERIC, 2),
        -- Problem score calculation (0-100)
        LEAST(100, (
            COALESCE(ROUND(100.0 * ist.rollbacks / NULLIF(ist.total, 0)), 0) * 0.7 + -- 70% weight on rollback rate
            CASE
                WHEN ist.avg_hours < 24 THEN 30  -- Critical if rolled back in <24 hours
                WHEN ist.avg_hours < 72 THEN 20  -- High if rolled back in <72 hours
                WHEN ist.avg_hours < 168 THEN 10 -- Medium if rolled back in <1 week
                ELSE 0
            END
        ))::INTEGER,
        -- Risk level
        CASE
            WHEN (100.0 * ist.rollbacks / NULLIF(ist.total, 0)) > 50 THEN 'CRITICAL'::VARCHAR(20)
            WHEN (100.0 * ist.rollbacks / NULLIF(ist.total, 0)) > 25 THEN 'HIGH'::VARCHAR(20)
            WHEN (100.0 * ist.rollbacks / NULLIF(ist.total, 0)) > 10 THEN 'MEDIUM'::VARCHAR(20)
            WHEN ist.rollbacks > 0 THEN 'LOW'::VARCHAR(20)
            ELSE 'STABLE'::VARCHAR(20)
        END
    FROM install_stats ist
    CROSS JOIN software s
    WHERE s.id = p_software_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_software_problem_score IS 'Calculates problem score for software based on rollback frequency and timing';

-- ----------------------------------------------------------------------------
-- FUNCTION: refresh_dashboard
-- Purpose: Helper to refresh the materialized view
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_dashboard()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY lpar_dashboard;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_dashboard IS 'Refreshes the lpar_dashboard materialized view';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

/*

-- 1. Get all software with current versions
SELECT * FROM software_with_current_version WHERE active = true;

-- 2. Check LPAR compliance
SELECT * FROM lpar_package_compliance WHERE compliance_status != 'COMPLIANT';

-- 3. View rollback history
SELECT * FROM rollback_history WHERE customer_name = 'Acme Corporation';

-- 4. Check version adoption
SELECT * FROM software_adoption_rate ORDER BY adoption_percentage DESC;

-- 5. Dashboard metrics
SELECT * FROM lpar_dashboard ORDER BY health_score ASC;
REFRESH MATERIALIZED VIEW CONCURRENTLY lpar_dashboard; -- Refresh when needed

-- 6. Plan upgrade path
SELECT * FROM get_version_upgrade_path(
    '<software_uuid>',
    'V5R4M0',
    'V5R6M0'
);

-- 7. Simulate package deployment
SELECT * FROM check_package_deployment_impact(
    '<lpar_uuid>',
    '<package_uuid>'
);

-- 8. Get software problem scores
SELECT * FROM get_software_problem_score('<software_uuid>', 90);

-- Or for all software:
SELECT s.id, ps.*
FROM software s
CROSS JOIN LATERAL get_software_problem_score(s.id, 90) ps
ORDER BY ps.problem_score DESC;

*/
