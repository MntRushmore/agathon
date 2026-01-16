-- ============================================
-- ADD ONBOARDING & TUTORIAL TRACKING FIELDS
-- ============================================
-- This adds fields to track student onboarding progress and feature discovery

-- ============================================
-- STEP 1: Add onboarding columns to profiles table
-- ============================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_completed_board_tutorial BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS milestones_achieved JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- STEP 2: Create index for faster onboarding queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding
ON profiles(onboarding_completed)
WHERE NOT onboarding_completed;

-- ============================================
-- STEP 3: Show current profiles structure
-- ============================================

SELECT '=== Profiles Table Columns ===' as section;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- STEP 4: Verify new columns exist
-- ============================================

SELECT '=== Verifying New Onboarding Columns ===' as section;

SELECT
  COUNT(*) FILTER (WHERE onboarding_completed IS NOT NULL) as has_onboarding_completed,
  COUNT(*) FILTER (WHERE has_completed_board_tutorial IS NOT NULL) as has_board_tutorial,
  COUNT(*) FILTER (WHERE milestones_achieved IS NOT NULL) as has_milestones
FROM profiles;

-- ============================================
-- COMPLETION
-- ============================================

SELECT '✅ Onboarding fields added successfully!' as status;
SELECT 'Students will now see welcome flow on first login' as next_step;
