# Quick Start: Fix Your Database Issues

## TL;DR - What to Do Right Now

Your app has infinite recursion errors in the database. Here's how to fix it in 3 steps:

### Step 1: Run the Fix Script (5 minutes)

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Go to SQL Editor
3. Copy and paste **ALL** of `COMPLETE_FIX_WITH_METADATA.sql`
4. Click "Run"
5. Wait for it to complete

### Step 2: Make Yourself an Admin (30 seconds)

In the same SQL Editor, run this (replace with your email):

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'YOUR-EMAIL@example.com';
```

### Step 3: Refresh and Test (1 minute)

1. Sign out of your app
2. Sign back in
3. Click your profile menu
4. You should see "Admin Dashboard" button
5. Click it - data should load!

---

## What Was Wrong?

**Problem**: Infinite recursion in database policies causing:
- ❌ Admin dashboard showing 0 for everything
- ❌ Whiteboards not loading
- ❌ 500 errors everywhere

**Cause**: Database policies were checking themselves, creating infinite loops

**Fix**: New policies that use JWT tokens instead of database queries

---

## What's New?

✅ **Admin Dashboard Button** - Only visible to admins in the user menu
✅ **Better Error Handling** - Shows what's wrong and how to fix it
✅ **Admin Role Support** - Full admin permissions in the database
✅ **No More Infinite Recursion** - Policies rewritten to be safe

---

## Files to Know About

- `COMPLETE_FIX_WITH_METADATA.sql` ⭐ **Run this one!**
- `ADMIN_DASHBOARD_FIX_INSTRUCTIONS.md` - Detailed explanation
- `FIX_INFINITE_RECURSION.sql` - Policy fixes only (included in complete fix)

---

## Troubleshooting

**"Still seeing errors after running the script"**
→ Sign out and sign back in to refresh your session

**"Admin Dashboard button doesn't show"**
→ Make sure you ran Step 2 to make yourself an admin

**"Some data still shows 0"**
→ Check browser console for specific errors
→ Verify all migration files have been run

**"Need more help?"**
→ Read `ADMIN_DASHBOARD_FIX_INSTRUCTIONS.md` for detailed troubleshooting

---

That's it! Run the SQL script, make yourself admin, refresh. Done. 🎉
