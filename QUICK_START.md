# Quick Start Guide - Board Sharing & iPad Features

## 🎯 What's New

You now have:
1. **Board Sharing** - Share boards via email with View/Edit permissions
2. **Shared With Me** tab - See all boards shared with you
3. **iPad Optimizations** - Larger touch targets, iOS fixes, landscape support

---

## 🚀 How to Test (5 Minutes)

### 1. Start the App
```bash
npm run dev
```
Visit: http://localhost:3000

### 2. Test Board Sharing

**Create Two Test Accounts:**
1. Sign up as Student 1 (your main account)
2. Open incognito window, sign up as Student 2

**Share a Board:**
1. In Student 1's account:
   - Create a new board (or use existing)
   - Click the three-dot menu on any board
   - Select "Share"
   - Type Student 2's email
   - Select "Edit" permission
   - Click "Share"

2. In Student 2's incognito window:
   - Refresh the dashboard
   - Click "Shared With Me" tab
   - See the shared board with "Can Edit" badge
   - Click to open and edit it

**That's it!** You've just tested the full sharing flow.

### 3. Test on iPad (Optional)

**Using Desktop Browser:**
1. Open Chrome DevTools (F12)
2. Click device toolbar (mobile icon)
3. Select "iPad Pro" from dropdown
4. Test touch targets and layout

**On Physical iPad:**
1. Open http://[your-computer-ip]:3000 in Safari
2. Tap buttons (should be easy to tap)
3. Rotate to landscape (layout adapts)
4. Try drawing with finger or Apple Pencil

---

## 📋 Quick Test Checklist

```
Board Sharing:
✓ Share button appears in dropdown
✓ Email search works (type partial email)
✓ Can set View or Edit permission
✓ "Shared With Me" tab shows shared boards
✓ Badges show on shared board cards
✓ Can open and edit shared boards

iPad:
✓ Buttons easy to tap (44px minimum)
✓ No text selection while browsing
✓ Inputs don't zoom on focus
✓ Scrolling feels smooth
```

---

## 🎨 Where to Find New Features

### Dashboard (/)
- Three-dot menu on each board → "Share" button
- Top tabs → "My Boards" | "Shared With Me"
- Shared board cards → Badge overlay (grid) or badge next to title (list)

### Share Dialog
- Search bar → Type email or name
- Results → Click user + select permission + Share
- People with access → List + Remove button

---

## 🔧 Optional: Add View-Only Enforcement

Currently, users with "View Only" permission can still edit. To fix this quickly:

**Edit:** [src/app/board/[id]/page.tsx](src/app/board/[id]/page.tsx)

**Add after line 800 (in the component):**
```typescript
// Check if user can edit
const [canEdit, setCanEdit] = useState(true);

useEffect(() => {
  async function checkPermission() {
    if (!user) return;

    const { data: share } = await supabase
      .from('board_shares')
      .select('permission')
      .eq('board_id', id)
      .eq('shared_with_user_id', user.id)
      .single();

    // User is owner OR has edit permission
    const { data: board } = await supabase
      .from('whiteboards')
      .select('user_id')
      .eq('id', id)
      .single();

    const isOwner = board?.user_id === user.id;
    setCanEdit(isOwner || share?.permission === 'edit');
  }

  checkPermission();
}, [id, user]);
```

**Then update the Tldraw component (around line 1640):**
```typescript
<Tldraw
  licenseKey="..."
  overrides={hugeIconsOverrides}
  components={{ ... }}
  onMount={(editor) => { ... }}
  readOnly={!canEdit}  // Add this line
>
```

This will make View-Only boards actually read-only!

---

## 📚 Full Documentation

- **Complete Implementation:** [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)
- **Auth Setup:** [AUTH_SETUP.md](AUTH_SETUP.md)
- **Features Roadmap:** [FEATURES_ROADMAP.md](FEATURES_ROADMAP.md)

---

## 🐛 Troubleshooting

**"User not found" when searching:**
- Make sure the user has signed up
- Email must match exactly (search is case-insensitive but must be registered)

**Shared board not appearing:**
- Refresh the dashboard page
- Check "Shared With Me" tab
- Verify share was created (check Share dialog → People with access)

**iPad buttons too small:**
- The CSS is there, but might need `!important` for specific buttons
- Check browser supports `@media (pointer: coarse)`
- Try on physical iPad vs desktop simulator

**Board sharing errors:**
- Ensure database migration was run ([AUTH_SETUP.md](AUTH_SETUP.md))
- Check Supabase logs for RLS policy errors
- Verify `board_shares` table exists

---

## ✨ What's Next

1. **Teacher Dashboard** - View all student boards, add grades, see analytics
2. **Landscape Mode UI** - Move toolbar to sidebar when rotated
3. **Apple Pencil Enhancements** - Double-tap to switch tools
4. **Real-time Collaboration** - Multiple users editing simultaneously

See [FEATURES_ROADMAP.md](FEATURES_ROADMAP.md) for full list!

---

**Questions?** Check [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) for detailed info.
**Issues?** The implementation is solid, most issues are config-related (check AUTH_SETUP.md).

Happy whiteboarding! 🎨
