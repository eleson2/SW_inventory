-- ============================================================================
-- TRIGRAM INDEXES FOR FAST SUBSTRING SEARCH
-- ============================================================================
-- Purpose: Enable fast ILIKE '%search%' queries using pg_trgm extension
-- Performance: 10-100x faster for substring searches on large datasets
-- Trade-off: Slightly larger indexes, minimal INSERT/UPDATE overhead
-- ============================================================================

-- Enable pg_trgm extension (trigram matching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

COMMENT ON EXTENSION pg_trgm IS 'Trigram similarity matching for fast substring search';

-- ----------------------------------------------------------------------------
-- CUSTOMERS TABLE
-- ----------------------------------------------------------------------------

-- Drop existing B-tree index on name (will be replaced with GIN trigram index)
DROP INDEX IF EXISTS "customers_name_idx";

-- Create GIN trigram indexes for fast substring search
CREATE INDEX customers_name_trgm_idx ON customers USING gin (name gin_trgm_ops);
CREATE INDEX customers_code_trgm_idx ON customers USING gin (code gin_trgm_ops);

COMMENT ON INDEX customers_name_trgm_idx IS 'Trigram index for fast ILIKE search on customer names';
COMMENT ON INDEX customers_code_trgm_idx IS 'Trigram index for fast ILIKE search on customer codes';

-- ----------------------------------------------------------------------------
-- VENDORS TABLE
-- ----------------------------------------------------------------------------

-- Drop existing B-tree index on name (will be replaced with GIN trigram index)
DROP INDEX IF EXISTS "vendors_name_idx";

-- Create GIN trigram indexes
CREATE INDEX vendors_name_trgm_idx ON vendors USING gin (name gin_trgm_ops);
CREATE INDEX vendors_code_trgm_idx ON vendors USING gin (code gin_trgm_ops);

COMMENT ON INDEX vendors_name_trgm_idx IS 'Trigram index for fast ILIKE search on vendor names';
COMMENT ON INDEX vendors_code_trgm_idx IS 'Trigram index for fast ILIKE search on vendor codes';

-- ----------------------------------------------------------------------------
-- SOFTWARE TABLE
-- ----------------------------------------------------------------------------

-- Drop existing B-tree index on name (will be replaced with GIN trigram index)
DROP INDEX IF EXISTS "software_name_idx";

-- Create GIN trigram index
CREATE INDEX software_name_trgm_idx ON software USING gin (name gin_trgm_ops);

COMMENT ON INDEX software_name_trgm_idx IS 'Trigram index for fast ILIKE search on software names';

-- Optional: Uncomment if you decide to search descriptions
-- CREATE INDEX software_description_trgm_idx ON software USING gin (description gin_trgm_ops);
-- COMMENT ON INDEX software_description_trgm_idx IS 'Trigram index for fast ILIKE search on software descriptions';

-- ----------------------------------------------------------------------------
-- LPARS TABLE
-- ----------------------------------------------------------------------------

-- Create GIN trigram indexes (no existing B-tree index to drop)
CREATE INDEX lpars_name_trgm_idx ON lpars USING gin (name gin_trgm_ops);
CREATE INDEX lpars_code_trgm_idx ON lpars USING gin (code gin_trgm_ops);

COMMENT ON INDEX lpars_name_trgm_idx IS 'Trigram index for fast ILIKE search on LPAR names';
COMMENT ON INDEX lpars_code_trgm_idx IS 'Trigram index for fast ILIKE search on LPAR codes';

-- ----------------------------------------------------------------------------
-- PACKAGES TABLE
-- ----------------------------------------------------------------------------

-- Create GIN trigram indexes (no existing B-tree index to drop)
CREATE INDEX packages_name_trgm_idx ON packages USING gin (name gin_trgm_ops);
CREATE INDEX packages_code_trgm_idx ON packages USING gin (code gin_trgm_ops);

COMMENT ON INDEX packages_name_trgm_idx IS 'Trigram index for fast ILIKE search on package names';
COMMENT ON INDEX packages_code_trgm_idx IS 'Trigram index for fast ILIKE search on package codes';

-- ----------------------------------------------------------------------------
-- VERIFICATION QUERIES
-- ----------------------------------------------------------------------------

-- Run these queries to verify indexes are created and being used:

/*

-- 1. List all trigram indexes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE indexdef LIKE '%gin_trgm_ops%'
ORDER BY tablename, indexname;

-- 2. Test index usage with EXPLAIN
EXPLAIN ANALYZE
SELECT * FROM vendors WHERE name ILIKE '%ibm%';

-- 3. Compare query plans before/after
-- Should show "Bitmap Heap Scan" with "Bitmap Index Scan" using trigram index
-- Instead of "Seq Scan" (full table scan)

-- 4. Check index statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_trgm_idx'
ORDER BY idx_scan DESC;

*/

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
/*

Expected Performance Improvements:
- Small tables (< 100 rows): 2-3x faster
- Medium tables (100-1000 rows): 5-10x faster
- Large tables (1000+ rows): 10-100x faster

Index Sizes:
- GIN trigram indexes are typically 2-3x larger than B-tree indexes
- Trade-off is worth it for substring search performance

When NOT to Use:
- If you only need exact matches (use unique constraints)
- If you only need prefix matches like 'search%' (B-tree is fine)
- For very small tables (< 50 rows), index overhead may exceed benefit

Maintenance:
- Indexes are automatically maintained by PostgreSQL
- Minimal impact on INSERT/UPDATE performance
- Consider REINDEX if search performance degrades over time:
  REINDEX INDEX CONCURRENTLY customers_name_trgm_idx;

*/
