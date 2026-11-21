-- =====================================================
-- Package Deployment Function
-- =====================================================
-- This function deploys a package to multiple LPARs in a single operation.
-- It handles both new installations and version updates, storing previous
-- versions for rollback capability.
--
-- Parameters:
--   p_package_id: UUID of the package to deploy
--   p_lpar_ids: Array of LPAR UUIDs to deploy to
--
-- Returns: Table with deployment results per LPAR
-- =====================================================

-- Drop the function if it exists (needed when changing return type)
DROP FUNCTION IF EXISTS deploy_package_to_lpars(UUID, UUID[]);

CREATE OR REPLACE FUNCTION deploy_package_to_lpars(
    p_package_id UUID,
    p_lpar_ids UUID[]
)
RETURNS TABLE (
    result_lpar_id UUID,
    result_lpar_name TEXT,
    result_items_created INTEGER,
    result_items_updated INTEGER,
    result_status TEXT
) AS $$
BEGIN
    -- Step 1: UPSERT all software installations and update LPARs
    RETURN QUERY
    WITH deployment_matrix AS (
        -- Cross join LPARs with package items to get all combinations
        SELECT
            l.id as lpar_id,
            l.name as lpar_name,
            pi.software_id,
            sv.version as new_version,
            sv.ptf_level as new_ptf_level,
            ls.current_version as old_version,
            ls.current_ptf_level as old_ptf_level,
            CASE WHEN ls.lpar_id IS NULL THEN 'create' ELSE 'update' END as operation
        FROM unnest(p_lpar_ids) as lpar_uuid
        JOIN lpars l ON l.id = lpar_uuid
        CROSS JOIN package_items pi
        JOIN software_versions sv ON sv.id = pi.software_version_id
        LEFT JOIN lpar_software ls ON ls.lpar_id = l.id AND ls.software_id = pi.software_id
        WHERE pi.package_id = p_package_id
    ),
    upsert_results AS (
        -- Perform UPSERT (insert or update)
        INSERT INTO lpar_software (
            lpar_id,
            software_id,
            current_version,
            current_ptf_level,
            previous_version,
            previous_ptf_level,
            installed_date,
            rolled_back,
            rolled_back_at,
            rollback_reason
        )
        SELECT
            dm.lpar_id,
            dm.software_id,
            dm.new_version,
            dm.new_ptf_level,
            dm.old_version,  -- Store old version as previous
            dm.old_ptf_level,
            NOW(),
            false,
            NULL,
            NULL
        FROM deployment_matrix dm
        ON CONFLICT (lpar_id, software_id) DO UPDATE SET
            previous_version = EXCLUDED.previous_version,
            previous_ptf_level = EXCLUDED.previous_ptf_level,
            current_version = EXCLUDED.current_version,
            current_ptf_level = EXCLUDED.current_ptf_level,
            installed_date = EXCLUDED.installed_date,
            rolled_back = false,
            rolled_back_at = NULL,
            rollback_reason = NULL
        RETURNING lpar_id, software_id
    ),
    summary_by_lpar AS (
        -- Count creates vs updates per LPAR
        SELECT
            dm.lpar_id,
            dm.lpar_name,
            COUNT(*) FILTER (WHERE dm.operation = 'create') as creates,
            COUNT(*) FILTER (WHERE dm.operation = 'update') as updates
        FROM deployment_matrix dm
        GROUP BY dm.lpar_id, dm.lpar_name
    )
    -- Step 2: Update LPAR package assignments
    , lpar_updates AS (
        UPDATE lpars
        SET
            current_package_id = p_package_id,
            updated_at = NOW()
        WHERE id = ANY(p_lpar_ids)
        RETURNING id
    )
    -- Step 3: Return summary
    SELECT
        s.lpar_id as result_lpar_id,
        s.lpar_name as result_lpar_name,
        s.creates::INTEGER as result_items_created,
        s.updates::INTEGER as result_items_updated,
        'success'::TEXT as result_status
    FROM summary_by_lpar s
    ORDER BY s.lpar_name;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Example Usage:
-- =====================================================
-- SELECT * FROM deploy_package_to_lpars(
--     'package-uuid-here'::uuid,
--     ARRAY['lpar-uuid-1', 'lpar-uuid-2']::uuid[]
-- );
