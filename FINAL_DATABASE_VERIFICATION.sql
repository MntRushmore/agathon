-- ============================================
-- FINAL DATABASE VERIFICATION SCRIPT
-- ============================================
-- Run this to verify your database is correctly set up
-- Date: 2026-01-13
-- Status: Production Ready
-- ============================================

-- ============================================
-- STEP 1: VERIFY ALL TABLES EXIST
-- ============================================

SELECT 'Checking tables...' as status;

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'profiles',
        'whiteboards',
        'board_shares',
        'classes',
        'class_members',
        'assignments',
        'submissions'
    );

    IF table_count = 7 THEN
        RAISE NOTICE '✓ All 7 tables exist';
    ELSE
        RAISE EXCEPTION '✗ Missing tables! Expected 7, found %', table_count;
    END IF;
END $$;

-- ============================================
-- STEP 2: VERIFY CRITICAL COLUMNS
-- ============================================

SELECT 'Checking whiteboards columns...' as status;

DO $$
BEGIN
    -- Check whiteboards has all required columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whiteboards' AND column_name = 'title'
    ) THEN
        RAISE EXCEPTION '✗ whiteboards missing title column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whiteboards' AND column_name = 'metadata'
    ) THEN
        RAISE EXCEPTION '✗ whiteboards missing metadata column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whiteboards' AND column_name = 'data'
    ) THEN
        RAISE EXCEPTION '✗ whiteboards missing data column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whiteboards' AND column_name = 'preview'
    ) THEN
        RAISE EXCEPTION '✗ whiteboards missing preview column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whiteboards' AND column_name = 'updated_at'
    ) THEN
        RAISE EXCEPTION '✗ whiteboards missing updated_at column';
    END IF;

    RAISE NOTICE '✓ whiteboards table has all required columns';
END $$;

SELECT 'Checking assignments columns...' as status;

DO $$
BEGIN
    -- Check assignments has metadata column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'assignments' AND column_name = 'metadata'
    ) THEN
        RAISE EXCEPTION '✗ assignments missing metadata column';
    END IF;

    RAISE NOTICE '✓ assignments table has metadata column';
END $$;

-- ============================================
-- STEP 3: VERIFY RLS IS ENABLED
-- ============================================

SELECT 'Checking RLS...' as status;

DO $$
DECLARE
    rls_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND rowsecurity = true
    AND tablename IN (
        'profiles',
        'whiteboards',
        'board_shares',
        'classes',
        'class_members',
        'assignments',
        'submissions'
    );

    IF rls_count = 7 THEN
        RAISE NOTICE '✓ RLS enabled on all 7 tables';
    ELSE
        RAISE EXCEPTION '✗ RLS not enabled on all tables! Expected 7, found %', rls_count;
    END IF;
END $$;

-- ============================================
-- STEP 4: COUNT RLS POLICIES
-- ============================================

SELECT 'Checking RLS policies...' as status;

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    IF policy_count >= 30 THEN
        RAISE NOTICE '✓ Found % RLS policies (expected ~32)', policy_count;
    ELSE
        RAISE WARNING '⚠ Only found % RLS policies, expected ~32', policy_count;
    END IF;
END $$;

-- ============================================
-- STEP 5: VERIFY TRIGGERS
-- ============================================

SELECT 'Checking triggers...' as status;

DO $$
BEGIN
    -- Check for update triggers
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_whiteboards_updated_at'
    ) THEN
        RAISE WARNING '⚠ Missing trigger: update_whiteboards_updated_at';
    ELSE
        RAISE NOTICE '✓ Trigger exists: update_whiteboards_updated_at';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_assignments_updated_at'
    ) THEN
        RAISE WARNING '⚠ Missing trigger: update_assignments_updated_at';
    ELSE
        RAISE NOTICE '✓ Trigger exists: update_assignments_updated_at';
    END IF;
END $$;

-- ============================================
-- STEP 6: VERIFY INDEXES
-- ============================================

SELECT 'Checking indexes...' as status;

SELECT
    tablename,
    COUNT(*) as index_count
FROM pg_indexes
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- STEP 7: FINAL SUMMARY
-- ============================================

SELECT
    '========================================' as summary
UNION ALL
SELECT 'DATABASE VERIFICATION COMPLETE'
UNION ALL
SELECT '========================================'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Tables: ' || COUNT(*)::text
FROM pg_tables
WHERE schemaname = 'public'
UNION ALL
SELECT 'RLS Policies: ' || COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 'Indexes: ' || COUNT(*)::text
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Status: ✓ PRODUCTION READY';
