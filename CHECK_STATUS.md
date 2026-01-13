# Status Check - Expo iPad App

## ✅ Current Status

**Next.js Server:** Running at `http://10.0.0.95:3000`
**Auth Mode:** Disabled (no-auth mode)
**Create Board:** Working (creates temp boards)
**Drawing:** Ready to test

---

## Quick Health Check

Run this to verify everything is working:

```bash
# 1. Check if Next.js is running
curl -s -o /dev/null -w "Next.js: HTTP %{http_code}\n" http://10.0.0.95:3000

# 2. Check if New Board button exists in page
curl -s http://10.0.0.95:3000 | grep -o "New Board" && echo "✅ UI loaded"

# 3. Check local network accessibility
curl -s -o /dev/null -w "Network: HTTP %{http_code}\n" http://10.0.0.95:3000

# All should return "200" or "✅"
```

---

## If You See "Error Loading Page"

### Cause 1: Next.js Crashed
**Fix:**
```bash
# Restart Next.js
pkill -f "next dev"
npm run dev -- -H 0.0.0.0 > /tmp/nextjs.log 2>&1 &

# Wait 5 seconds, then check
sleep 5
curl http://localhost:3000
```

### Cause 2: Wrong IP Address
**Fix:**
```bash
# Get your current IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Update expo-app/components/WebViewWrapper.tsx
# Change line 10 to match your current IP
```

### Cause 3: Firewall Blocking Port 3000
**Fix:**
```bash
# macOS: Allow port 3000
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Add Node/npm to allowed apps
```

### Cause 4: Network Changed (Different WiFi)
**Fix:**
```bash
# Get new IP address
ifconfig | grep "inet " | grep -v 127.0.0.1

# Update WebViewWrapper.tsx with new IP
# Restart both Next.js and Expo
```

---

## Restart Everything

If nothing else works, do a full restart:

```bash
# 1. Stop all processes
pkill -f "next dev"
pkill -f "expo"

# 2. Start Next.js
cd /Users/rushilchopra/madhacks/madhacks
npm run dev -- -H 0.0.0.0 > /tmp/nextjs.log 2>&1 &

# 3. Wait for it to start
sleep 5

# 4. Verify it works
curl http://localhost:3000

# 5. Start Expo
cd expo-app
npx expo start --clear
```

---

## View Next.js Logs

```bash
# Watch logs in real-time
tail -f /tmp/nextjs.log

# See last 50 lines
tail -50 /tmp/nextjs.log

# Check for errors
grep -i error /tmp/nextjs.log
```

---

## Test from iPad/Simulator

### In iOS Simulator:
1. Open Safari
2. Go to: `http://10.0.0.95:3000`
3. Should see the dashboard with "New Board" button
4. If this works, Expo app should work too

### In Expo Go (Physical iPad):
1. Make sure iPad is on same WiFi as your Mac
2. Expo app should load at: `http://10.0.0.95:3000`
3. Check Expo terminal for any errors

---

## Common Expo Errors

### Error: "Domain NSURLErrorDomain Error code -1004"
**Meaning:** Can't reach Next.js server
**Fix:**
1. Verify Next.js is running: `curl http://10.0.0.95:3000`
2. Check IP is correct in WebViewWrapper.tsx
3. Make sure firewall isn't blocking

### Error: "Failed to load resource"
**Meaning:** Next.js crashed or returned error
**Fix:**
1. Check Next.js logs: `tail -50 /tmp/nextjs.log`
2. Look for errors or crashes
3. Restart Next.js if needed

### Error: "Network request failed"
**Meaning:** Network connectivity issue
**Fix:**
1. Check WiFi connection
2. Verify IP hasn't changed
3. Try pinging: `ping 10.0.0.95`

---

## Current Configuration

**Files:**
- Next.js at: `/Users/rushilchopra/madhacks/madhacks`
- Expo app at: `/Users/rushilchopra/madhacks/madhacks/expo-app`
- Logs at: `/tmp/nextjs.log`

**Network:**
- Local: `http://localhost:3000`
- Network: `http://10.0.0.95:3000`

**Auth:**
- Middleware: Disabled (`middleware.ts.bak`)
- Mode: No-auth (temp boards only)
- Database: Not required

---

## Success Checklist

Before testing Expo app, verify:

- [x] Next.js running on port 3000
- [x] Returns HTTP 200 for `http://10.0.0.95:3000`
- [x] Page contains "New Board" button
- [x] No errors in Next.js logs
- [x] Network accessible (not just localhost)

If all ✅, then Expo app should work!

---

## Quick Commands

```bash
# Check status
curl http://10.0.0.95:3000 && echo "✅ Working"

# Restart Next.js
pkill -f "next dev" && npm run dev -- -H 0.0.0.0 > /tmp/nextjs.log 2>&1 &

# Restart Expo
cd expo-app && npx expo start --clear

# View logs
tail -f /tmp/nextjs.log
```

---

**Last Updated:** Just now
**Status:** ✅ All systems operational
**Ready for testing!**
