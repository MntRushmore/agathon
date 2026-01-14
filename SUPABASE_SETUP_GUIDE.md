# Supabase Setup Guide

## Step 1: Get Your Supabase Credentials

You provided the direct database connection string, but we also need the Supabase URL and anon key for the application.

### Get Credentials from Supabase Dashboard:

1. Go to https://supabase.com/dashboard/project/isrckjwuybjzgffkgeey
2. Go to **Settings** → **API**
3. Copy these values:
   - **Project URL** (looks like: `https://isrckjwuybjzgffkgeey.supabase.co`)
   - **Anon/Public Key** (long string starting with `eyJ...`)

## Step 2: Create `.env.local` File

Create a file called `.env.local` in the project root with this content:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://isrckjwuybjzgffkgeey.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Direct Database URL (for migrations if needed)
DATABASE_URL=postgresql://postgres:xae1bgc-qhz-VQZ_xrx@db.isrckjwuybjzgffkgeey.supabase.co:5432/postgres
```

**Replace `your-anon-key-here` with the actual anon key from the dashboard.**

## Step 3: Run Database Migrations

We have two migration files that need to be run in order:

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to https://supabase.com/dashboard/project/isrckjwuybjzgffkgeey/sql/new

2. **First Migration** - Run the existing setup:
   - Open `supabase-setup.sql` in your editor
   - Copy the entire content
   - Paste into Supabase SQL Editor
   - Click "Run" (bottom right)
   - Wait for success message

3. **Second Migration** - Run the educational features:
   - Open `supabase/migrations/002_educational_features.sql`
   - Copy the entire content
   - Paste into Supabase SQL Editor
   - Click "Run"
   - Wait for success message

### Option B: Using psql (Command Line)

```bash
# Run existing setup
psql "postgresql://postgres:xae1bgc-qhz-VQZ_xrx@db.isrckjwuybjzgffkgeey.supabase.co:5432/postgres" < supabase-setup.sql

# Run educational features migration
psql "postgresql://postgres:xae1bgc-qhz-VQZ_xrx@db.isrckjwuybjzgffkgeey.supabase.co:5432/postgres" < supabase/migrations/002_educational_features.sql
```

## Step 4: Verify Database Setup

After running migrations, verify in Supabase:

1. Go to **Table Editor**
2. Check that these tables exist:
   - ✅ `profiles`
   - ✅ `whiteboards`
   - ✅ `board_shares`
   - ✅ `classes` (new)
   - ✅ `class_members` (new)
   - ✅ `assignments` (new)
   - ✅ `submissions` (new)

3. Go to **Authentication** → **Policies**
4. Verify RLS is enabled on all tables

## Step 5: Enable Authentication

Currently auth is disabled. To enable it:

1. **Re-enable middleware:**
   ```bash
   mv src/middleware.ts.bak src/middleware.ts
   ```

2. **Update CreateClassDialog** to use real auth:
   - File: `src/components/teacher/CreateClassDialog.tsx`
   - Remove the temporary `tempUserId` line
   - Use real auth from Supabase

## Step 6: Test the Application

### Test Teacher Flow:
1. Go to http://localhost:3000
2. Sign up as a teacher
3. Create a class
4. Get join code
5. Go to class detail page
6. See empty roster

### Test Student Flow:
1. Open incognito window
2. Sign up as a student
3. Go to "Join a Class"
4. Enter join code
5. Verify you appear in teacher's roster

## Expected Behavior After Setup

### With Auth Enabled:
- ✅ Users must sign up/login
- ✅ Teachers can create classes
- ✅ Students can join with codes
- ✅ RLS policies enforce permissions
- ✅ Real user IDs in database

### Current State (Auth Disabled):
- ❌ Using temp IDs
- ❌ No real authentication
- ❌ RLS policies won't work
- ⚠️  For testing UI only

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists in project root
- Restart Next.js dev server: `npm run dev`

### "Row Level Security policy violation"
- Check that migrations ran successfully
- Verify RLS policies exist in Supabase dashboard
- Make sure user is authenticated

### "Join code not found"
- Verify classes table has data
- Check that join_code was auto-generated
- Try creating a new class

### "Cannot read properties of undefined"
- Check Supabase credentials are correct
- Verify anon key is not expired
- Check browser console for errors

## Next Steps After Setup

Once Supabase is configured:

1. **Enable Auth** - Re-enable middleware
2. **Update API Functions** - Remove temp IDs
3. **Test Full Flow** - Sign up → Create class → Join → View roster
4. **Continue Sprint 4** - Assignment creation

---

## Quick Reference

**Supabase Dashboard:** https://supabase.com/dashboard/project/isrckjwuybjzgffkgeey

**Tables to Verify:**
- profiles, whiteboards, board_shares (existing)
- classes, class_members, assignments, submissions (new)

**Migration Files:**
1. `supabase-setup.sql` (existing schema)
2. `supabase/migrations/002_educational_features.sql` (educational features)

**Required Env Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
