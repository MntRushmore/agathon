# Quick Fix for Expo App Loading Error

## The Problem

You're seeing: **"Domain NSURLErrorDomain Error code -1004"**

This error has **two possible causes**:

### Cause 1: Next.js not running (FIXED ✅)
- Next.js dev server is now running at `http://10.0.0.95:3000`
- The IP matches your WebView configuration

### Cause 2: Supabase credentials missing (CURRENT ISSUE ⚠️)
- Next.js is returning a 500 error
- Error: "Your project's URL and Key are required to create a Supabase client!"

---

## Solution: Configure Supabase Credentials

### Option 1: Quick Test Mode (Skip Auth - 5 seconds)

Temporarily disable auth middleware to test the app:

**Rename middleware file:**
```bash
mv src/middleware.ts src/middleware.ts.bak
```

Then restart Expo:
```bash
cd expo-app
npx expo start
```

The app should now load! (You won't have auth, but you can test drawing)

### Option 2: Proper Setup (With Auth - 2 minutes)

1. **Get Supabase credentials** from your project:
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Settings → API
   - Copy:
     - Project URL
     - Anon/Public key

2. **Create `.env.local` file** in root directory:

```bash
# In the root directory (madhacks/)
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EOF
```

3. **Restart Next.js**:

```bash
# Kill the current dev server
pkill -f "next dev"

# Start again
npm run dev -- -H 0.0.0.0
```

4. **Restart Expo**:

```bash
cd expo-app
npx expo start
```

---

## Verify It's Working

### Test 1: Check Next.js is accessible

```bash
curl http://10.0.0.95:3000
```

Should return HTML (not an error)

### Test 2: Check in browser

Open in your browser: `http://10.0.0.95:3000`

Should see the login page or dashboard

### Test 3: Launch Expo app

```bash
cd expo-app
npx expo start --ios
```

Should load without errors!

---

## If You Don't Have a Supabase Project

### Quick Setup (5 minutes):

1. Go to https://supabase.com
2. Sign up / Log in
3. Create new project
4. Wait ~2 minutes for setup
5. Run the database migration:
   - Go to SQL Editor
   - Paste contents of `supabase-setup.sql`
   - Click "Run"
6. Get credentials (Settings → API)
7. Add to `.env.local`

---

## Current Status

✅ **Next.js running**: http://10.0.0.95:3000
✅ **IP configured**: Matches WebView (10.0.0.95)
⚠️ **Supabase missing**: Need to add credentials or disable auth

---

## Quick Commands

**Disable auth for testing:**
```bash
mv src/middleware.ts src/middleware.ts.bak
pkill -f "next dev"
npm run dev -- -H 0.0.0.95 &
cd expo-app && npx expo start
```

**Enable auth (after adding .env.local):**
```bash
mv src/middleware.ts.bak src/middleware.ts
pkill -f "next dev"
npm run dev -- -H 0.0.0.95 &
cd expo-app && npx expo start
```

---

## Next Steps

1. Choose Option 1 (quick test) or Option 2 (proper setup)
2. Apply the fix
3. Restart Expo: `cd expo-app && npx expo start`
4. Press 'i' to open iOS Simulator

The app should load successfully! 🎉
