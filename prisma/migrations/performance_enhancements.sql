-- Performance Enhancement Migration for SW Inventory
-- Additional indexes and PostgreSQL functions

-- ============================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_lpars_customer_package_active
  ON lpars(customer_id, current_package_id, active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_lpar_software_composite
  ON lpar_software(lpar_id, software_id, rolled_back);

CREATE INDEX IF NOT EXISTS idx_package_items_software_version
  ON package_items(software_id, version, ptf_level);

-- GIN index for JSONB columns (fast JSON queries)
CREATE INDEX IF NOT EXISTS idx_software_version_history_gin
  ON software USING GIN (version_history);

CREATE INDEX IF NOT EXISTS idx_audit_log_changes_gin
  ON audit_log USING GIN (changes);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_software_name_trgm
  ON software USING gin (name gin_trgm_ops);

-- Partial indexes for common filters
CREATE INDEX IF NOT EXISTS idx_software_active_vendor
  ON software(vendor_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_packages_active_recent
  ON packages(release_date DESC)
  WHERE active = true;

-- ============================================================================
-- POSTGRESQL FUNCTIONS
-- ============================================================================

-- Function: Get LPAR compatibility score with a package
CREATE OR REPLACE FUNCTION get_lpar_package_compatibility(
  p_lpar_id UUID,
  p_package_id UUID
) RETURNS INTEGER AS $$
DECLARE
  total_items INTEGER;
  compatible_items INTEGER;
BEGIN
  -- Count total required items in package
  SELECT COUNT(*)
  INTO total_items
  FROM package_items
  WHERE package_id = p_package_id;

  IF total_items = 0 THEN
    RETURN 100;
  END IF;

  -- Count compatible installed software
  SELECT COUNT(*)
  INTO compatible_items
  FROM package_items pi
  INNER JOIN lpar_software ls ON pi.software_id = ls.software_id
  WHERE pi.package_id = p_package_id
    AND ls.lpar_id = p_lpar_id
    AND ls.current_version >= pi.version;

  RETURN ROUND((compatible_items::NUMERIC / total_items::NUMERIC) * 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Get software version history
CREATE OR REPLACE FUNCTION get_software_versions(p_software_id UUID)
RETURNS TABLE(version TEXT, ptf_level TEXT, released_at TIMESTAMP) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (value->>'version')::TEXT as version,
    (value->>'ptfLevel')::TEXT as ptf_level,
    TO_TIMESTAMP((value->>'releasedAt')::TEXT, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as released_at
  FROM software,
       jsonb_array_elements(version_history) as value
  WHERE id = p_software_id
  ORDER BY released_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Clone software product
CREATE OR REPLACE FUNCTION clone_software(
  p_source_id UUID,
  p_new_name TEXT,
  p_new_code TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_id UUID;
  source_record RECORD;
BEGIN
  -- Get source software
  SELECT * INTO source_record
  FROM software
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source software not found';
  END IF;

  -- Insert cloned software
  INSERT INTO software (
    name,
    vendor_id,
    description,
    current_version,
    current_ptf_level,
    version_history,
    active,
    created_at,
    updated_at
  )
  VALUES (
    p_new_name,
    source_record.vendor_id,
    'Cloned from: ' || source_record.name || COALESCE(E'

' || source_record.description, ''),
    source_record.current_version,
    source_record.current_ptf_level,
    source_record.version_history,
    source_record.active,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Clone package
CREATE OR REPLACE FUNCTION clone_package(
  p_source_id UUID,
  p_new_name TEXT,
  p_new_code TEXT,
  p_new_version TEXT
) RETURNS UUID AS $$
DECLARE
  new_package_id UUID;
  source_record RECORD;
  item_record RECORD;
BEGIN
  -- Get source package
  SELECT * INTO source_record
  FROM packages
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source package not found';
  END IF;

  -- Insert cloned package
  INSERT INTO packages (
    name,
    code,
    description,
    version,
    release_date,
    active,
    created_at,
    updated_at
  )
  VALUES (
    p_new_name,
    p_new_code,
    'Cloned from: ' || source_record.name || COALESCE(E'

' || source_record.description, ''),
    p_new_version,
    NOW(),
    source_record.active,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_package_id;

  -- Clone all package items
  FOR item_record IN
    SELECT * FROM package_items WHERE package_id = p_source_id
  LOOP
    INSERT INTO package_items (
      package_id,
      software_id,
      version,
      ptf_level,
      required,
      order_index,
      created_at
    )
    VALUES (
      new_package_id,
      item_record.software_id,
      item_record.version,
      item_record.ptf_level,
      item_record.required,
      item_record.order_index,
      NOW()
    );
  END LOOP;

  RETURN new_package_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Clone LPAR
CREATE OR REPLACE FUNCTION clone_lpar(
  p_source_id UUID,
  p_new_name TEXT,
  p_new_code TEXT,
  p_customer_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  new_lpar_id UUID;
  source_record RECORD;
  sw_record RECORD;
  target_customer_id UUID;
BEGIN
  -- Get source LPAR
  SELECT * INTO source_record
  FROM lpars
  WHERE id = p_source_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source LPAR not found';
  END IF;

  -- Use provided customer_id or source customer_id
  target_customer_id := COALESCE(p_customer_id, source_record.customer_id);

  -- Insert cloned LPAR
  INSERT INTO lpars (
    name,
    code,
    customer_id,
    description,
    current_package_id,
    active,
    created_at,
    updated_at
  )
  VALUES (
    p_new_name,
    p_new_code,
    target_customer_id,
    'Cloned from: ' || source_record.name || COALESCE(E'

' || source_record.description, ''),
    source_record.current_package_id,
    source_record.active,
    NOW(),
    NOW()
  )
  RETURNING id INTO new_lpar_id;

  -- Clone all installed software
  FOR sw_record IN
    SELECT * FROM lpar_software WHERE lpar_id = p_source_id
  LOOP
    INSERT INTO lpar_software (
      lpar_id,
      software_id,
      current_version,
      current_ptf_level,
      previous_version,
      previous_ptf_level,
      installed_date,
      rolled_back
    )
    VALUES (
      new_lpar_id,
      sw_record.software_id,
      sw_record.current_version,
      sw_record.current_ptf_level,
      sw_record.previous_version,
      sw_record.previous_ptf_level,
      NOW(),
      false  -- Reset rollback status
    );
  END LOOP;

  RETURN new_lpar_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Search across multiple entities
CREATE OR REPLACE FUNCTION global_search(p_query TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  entity_type TEXT,
  entity_id UUID,
  name TEXT,
  code TEXT,
  description TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT
      'customer'::TEXT as entity_type,
      c.id as entity_id,
      c.name,
      c.code,
      c.description,
      similarity(c.name, p_query) + similarity(COALESCE(c.code, ''), p_query) as rank
    FROM customers c
    WHERE c.name ILIKE '%' || p_query || '%'
       OR c.code ILIKE '%' || p_query || '%'
  )
  UNION ALL
  (
    SELECT
      'software'::TEXT,
      s.id,
      s.name,
      NULL as code,
      s.description,
      similarity(s.name, p_query) as rank
    FROM software s
    WHERE s.name ILIKE '%' || p_query || '%'
  )
  UNION ALL
  (
    SELECT
      'package'::TEXT,
      p.id,
      p.name,
      p.code,
      p.description,
      similarity(p.name, p_query) + similarity(COALESCE(p.code, ''), p_query) as rank
    FROM packages p
    WHERE p.name ILIKE '%' || p_query || '%'
       OR p.code ILIKE '%' || p_query || '%'
  )
  UNION ALL
  (
    SELECT
      'lpar'::TEXT,
      l.id,
      l.name,
      l.code,
      l.description,
      similarity(l.name, p_query) + similarity(COALESCE(l.code, ''), p_query) as rank
    FROM lpars l
    WHERE l.name ILIKE '%' || p_query || '%'
       OR l.code ILIKE '%' || p_query || '%'
  )
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pg_trgm for similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION get_lpar_package_compatibility IS
  'Calculate percentage compatibility between an LPAR and a package based on installed software versions';

COMMENT ON FUNCTION get_software_versions IS
  'Extract and return version history from JSONB column in a structured format';

COMMENT ON FUNCTION clone_software IS
  'Clone a software product with all its metadata, creating a new independent copy';

COMMENT ON FUNCTION clone_package IS
  'Clone a package with all its items, creating a new version for deployment';

COMMENT ON FUNCTION clone_lpar IS
  'Clone an LPAR with all its installed software, optionally to a different customer';

COMMENT ON FUNCTION global_search IS
  'Search across customers, software, packages, and LPARs with relevance ranking';
