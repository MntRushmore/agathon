# Admin Dashboard Fix Instructions

## Problem Summary

Your application was experiencing **infinite recursion errors** in Supabase RLS (Row Level Security) policies. This prevented data from loading on all pages, including:
- Admin dashboard showing 0 for all stats
- Whiteboards not loading
- User profiles not loading

The error message was: `"infinite recursion detected in policy for relation 'profiles'"` and `"infinite recursion detected in policy for relation 'whiteboards'"`

## Root Cause

The RLS policies in `supabase-setup.sql` were creating infinite recursion:

1. **Profiles Policy Problem**: The policy "Teachers can view all profiles" checked if a user was a teacher by querying the `profiles` table, which triggered the same policy recursively.

2. **Whiteboards Policy Problem**: Similar issue with "Teachers can view all whiteboards" policy.

## Solution Applied

### 1. Fixed RLS Policies (SQL Script)

A new SQL fix script has been created: `FIX_INFINITE_RECURSION.sql`

**Key Changes:**
- Instead of querying the `profiles` table within policies, we now use `auth.jwt()` to check user metadata
- Added proper admin role support throughout
- Created separate policies for admins, teachers, and students

### 2. Updated Admin Dashboard

**File: `src/app/admin/page.tsx`**

Changes:
- Added proper role checking (redirects non-admins)
- Improved error handling with `Promise.allSettled` to handle partial failures
- Added error alerts to show users when database issues occur
- Better loading states

### 3. Added Admin Dashboard Button

**File: `src/components/auth/user-menu.tsx`**

Changes:
- Added "Admin Dashboard" button in user menu (only visible to admins)
- Uses Shield icon for visual distinction
- Navigates to `/admin` route

## How to Fix Your Database

### Step 1: Run the Fix Script

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Copy the contents of `FIX_INFINITE_RECURSION.sql`
3. Paste it into the SQL Editor
4. Click "Run" to execute

This script will:
- Drop all existing recursive policies
- Create new non-recursive policies using JWT metadata
- Add proper admin role support
- Verify all policies are working

### Step 2: Update Role Constraint (if needed)

If you haven't already added the 'admin' role to your profiles table:

```sql
-- Fix the role constraint to include 'admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));
```

### Step 3: Make Yourself an Admin

```sql
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### Step 4: Update User Metadata in Auth

For the JWT-based policies to work, you need to store the role in the user's metadata:

```sql
-- Function to sync role to user metadata
CREATE OR REPLACE FUNCTION sync_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the user's metadata in auth.users
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync role changes
DROP TRIGGER IF EXISTS sync_role_to_metadata_trigger ON profiles;
CREATE TRIGGER sync_role_to_metadata_trigger
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_metadata();

-- Sync existing users
UPDATE profiles SET updated_at = NOW();
```

### Step 5: Verify Everything Works

1. Refresh your application
2. Log in as an admin
3. Click your profile menu - you should see "Admin Dashboard" button
4. Navigate to Admin Dashboard - data should now load correctly
5. Check that whiteboards and other pages load properly

## What's New

### Admin Features

1. **Admin Dashboard Button**: Visible only to admins in the user menu
2. **Improved Dashboard**: Better error handling and informative error messages
3. **Full Admin Policies**: Admins can now:
   - View all profiles
   - View all whiteboards
   - Update any profile
   - Update any whiteboard
   - Delete any whiteboard
   - View all data in the system

### Better Error Handling

The admin dashboard now:
- Uses `Promise.allSettled` to handle partial database failures
- Shows clear error messages when permissions are missing
- Provides instructions on how to fix issues
- Still displays available data even if some queries fail

## Troubleshooting

### Issue: "Error Loading Data" alert appears

**Solution**: Run the `FIX_INFINITE_RECURSION.sql` script in your Supabase SQL editor.

### Issue: Admin Dashboard button doesn't appear

**Solution**:
1. Make sure you've set your user's role to 'admin' in the database
2. Sign out and sign back in to refresh your session

### Issue: Some stats show 0 but should have data

**Solution**:
1. Check that you've run all migration files in `supabase/migrations/`
2. Verify RLS policies allow admins to view all tables
3. Check browser console for specific error messages

### Issue: "Forbidden" or "Unauthorized" errors

**Solution**:
1. Verify you're logged in as an admin
2. Run the metadata sync function from Step 4 above
3. Sign out and sign back in

## Files Changed

1. `FIX_INFINITE_RECURSION.sql` - New SQL fix script ⭐ **RUN THIS FIRST**
2. `src/app/admin/page.tsx` - Improved admin dashboard
3. `src/components/auth/user-menu.tsx` - Added admin button
4. `src/components/ui/alert.tsx` - New alert component for errors
5. `supabase-setup.sql` - Updated to include admin role

## Support

If you continue to experience issues:
1. Check the browser console for error messages
2. Check the Supabase logs in the dashboard
3. Verify all SQL scripts ran successfully
4. Ensure you're logged in with an admin account
