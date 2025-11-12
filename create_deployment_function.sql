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
