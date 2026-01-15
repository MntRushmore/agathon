-- ============================================
-- FIX ADMIN ROLE CONSTRAINT
-- ============================================
-- This script fixes the profiles table constraint to allow 'admin' role
-- Run this if you're getting: "new row for relation "profiles" violates check constraint "profiles_role_check""

-- Drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the updated constraint that allows admin role
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('student', 'teacher', 'admin'));

-- Verify the constraint was updated
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass 
AND conname = 'profiles_role_check';

-- Show current profiles with their roles
SELECT id, email, full_name, role, created_at 
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

SELECT '✅ Admin role constraint fixed successfully!' as status;