# No-Auth Mode (Temporary Testing)

## Overview

The app is currently running in **no-auth mode** for testing the Expo iPad app without setting up Supabase.

## What Works

✅ **Create Board Button**
- Clicking "New Board" creates a temporary board with ID `temp-{timestamp}`
- Board opens immediately in TLDraw
- Full drawing functionality works

✅ **Drawing & Canvas**
- All TLDraw features work normally
- Apple Pencil detection (in native app)
- AI assistance modes (Feedback, Suggest, Solve)
- Voice mode

✅ **iPad Optimizations**
- Landscape mode
- Touch targets (44px minimum)
- iOS safe areas
- Native gestures

## What's Disabled

❌ **Database Operations**
- Boards are NOT saved to Supabase
- Refreshing the page will lose your work
- Can't view saved boards
- Can't share boards

❌ **Authentication**
- No login/signup
- No user profiles
- No board ownership

❌ **Real-time Collaboration**
- Live updates disabled for temp boards
- No presence tracking
- Can't share with others

## How It Works

### Dashboard (page.tsx)

```typescript
async function createWhiteboard() {
  if (!user) {
    // No auth - create temp board
    toast.info('Creating temporary board (auth disabled)');
    const tempId = `temp-${Date.now()}`;
    router.push(`/board/${tempId}`);
    return;
  }
  // ... normal database creation
}
```

### Board Page (board/[id]/page.tsx)

```typescript
// Load board
if (id.startsWith('temp-')) {
  console.log('Loading temporary board (no auth)');
  setBoardTitle('Temporary Board');
  setCanEdit(true);
  return;
}

// Auto-save
if (id.startsWith('temp-')) {
  console.log('Skipping auto-save for temporary board');
  return;
}

// Realtime
const shouldEnableRealtime = !id.startsWith('temp-') && userId;
```

## Files Modified for No-Auth Mode

1. **src/middleware.ts** → `src/middleware.ts.bak`
   - Auth middleware disabled entirely

2. **src/app/page.tsx**
   - Create board works without auth
   - Generates temp board IDs

3. **src/app/board/[id]/page.tsx**
   - Loads temp boards without database
   - Skips auto-save for temp boards
   - Disables realtime for temp boards
   - Always allows editing (canEdit = true)

## Re-enabling Auth

When ready to enable authentication:

### 1. Get Supabase Credentials

Visit: https://supabase.com/dashboard
- Settings → API
- Copy Project URL and Anon Key

### 2. Create .env.local

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EOF
```

### 3. Run Database Migration

In Supabase SQL Editor, run: `supabase-setup.sql`

### 4. Restore Middleware

```bash
mv src/middleware.ts.bak src/middleware.ts
```

### 5. Restart Next.js

```bash
pkill -f "next dev"
npm run dev -- -H 0.0.0.0
```

### 6. Restart Expo

```bash
cd expo-app
npx expo start
```

## Testing Checklist

### ✅ Works in No-Auth Mode
- [x] Click "New Board" button
- [x] Board opens with TLDraw
- [x] Can draw on canvas
- [x] Can use AI assistance modes
- [x] Landscape mode on iPad
- [x] Touch targets are large enough
- [x] Apple Pencil works (on physical iPad)

### ❌ Doesn't Work (Expected)
- [ ] Saving boards (no database)
- [ ] Viewing saved boards list
- [ ] Login/signup
- [ ] Sharing boards
- [ ] Real-time collaboration

## Current Status

**Next.js:** Running at `http://10.0.0.95:3000`
**Auth:** Disabled (middleware.ts.bak)
**Database:** Not required
**Expo App:** Ready to test

## Quick Test

```bash
# Make sure Next.js is running
npm run dev -- -H 0.0.0.0

# Start Expo
cd expo-app
npx expo start --ios

# In iOS Simulator:
# 1. Click "New Board"
# 2. Should see "Creating temporary board"
# 3. Canvas opens
# 4. Draw something
# 5. Works! ✅
```

## Troubleshooting

**"Create Board" does nothing:**
- Check browser console for errors
- Make sure Next.js is running
- Refresh the page

**Board doesn't load:**
- Check that it's a temp board (URL: `/board/temp-...`)
- Look for console message: "Loading temporary board"

**Canvas won't draw:**
- Not related to auth - check TLDraw setup
- Make sure canvas has focus (click on it)

## Notes

- Temp boards exist only in memory
- Refreshing loses all work
- Perfect for testing UI/UX
- NOT suitable for production
- Re-enable auth before deploying

---

**This is a temporary testing configuration!**
Enable full auth + database before production use.
