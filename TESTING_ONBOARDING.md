# Testing the Student Onboarding Experience

## Quick Test Guide

### Method 1: Reset Your Own Account (Recommended)

1. **Go to Admin Panel**
   - Navigate to `/admin/users`
   - You should see all users in the system

2. **Find Your Account**
   - Look for your email in the user list
   - Check the "Status" column - it will show if you've completed onboarding

3. **Reset Onboarding**
   - Click the 3-dot menu (⋮) next to your account
   - Select "Reset Onboarding"
   - Confirm the action

4. **Clear Browser Cache (Important!)**
   - The system uses localStorage for fast checks
   - Either:
     - Open DevTools (F12) → Application → Local Storage → Delete `onboarding_completed_v1`
     - Or use incognito/private browsing mode

5. **Sign Out and Sign Back In**
   - This refreshes your session
   - Go back to the homepage

6. **Experience the Full Flow**
   - **Welcome Dialog**: 4-step introduction
     - Welcome message
     - Role confirmation
     - Features overview
     - Choose first action (Join Class or Create Board)

   - **Dashboard Progress**:
     - See the "Getting Started Checklist" card
     - Quick stats showing your progress

   - **Create First Board**:
     - Click "Create Practice Board"
     - When the board opens, wait 2 seconds

   - **Interactive Tutorial**: 5-step guided tour
     - Canvas introduction
     - AI mode selector
     - Chat panel
     - Drawing toolbar
     - Auto-save explanation

   - **Celebrations**:
     - First board creation → Confetti + toast 🎉
     - Use any AI mode → Toast notification 🤖
     - Join a class → Confetti + toast (if you reset and rejoin)

### Method 2: Create Test Student Account

1. **Create New Account**
   - Sign out
   - Create a new account with a different email
   - Set role to "Student" during signup

2. **Experience Fresh Flow**
   - Immediately see welcome dialog on first login
   - All onboarding steps will trigger naturally

### Method 3: Impersonate Another User

1. **Go to Admin Users**
   - Navigate to `/admin/users`

2. **Reset Target User**
   - Find a student account
   - Reset their onboarding

3. **Impersonate**
   - Click 3-dot menu → "Impersonate"
   - You'll be logged in as that user
   - See the banner at the top
   - Experience onboarding as them

4. **Stop Impersonating**
   - Click "Stop Impersonating" in the banner

## What to Test

### Welcome Dialog
- [ ] Appears on first login for students
- [ ] 4 steps with clear navigation
- [ ] "Skip" button works
- [ ] Role confirmation updates correctly
- [ ] Can create practice board from final step
- [ ] Can join class from final step

### Dashboard
- [ ] Progress checklist shows 3 items
- [ ] Checklist updates as you complete tasks
- [ ] Checklist auto-hides when all 3 complete
- [ ] Quick stats show correct counts
- [ ] Empty states have actionable buttons

### Board Tutorial
- [ ] Triggers 2 seconds after opening first board
- [ ] Spotlight highlights correct UI elements
- [ ] Can skip tutorial
- [ ] Can navigate through all 5 steps
- [ ] Doesn't show again after completion
- [ ] Final step says "Start Working!"

### Celebrations
- [ ] First class join → Confetti + toast 🎉
- [ ] First board created → Confetti + toast ✨
- [ ] First AI usage → Toast (no confetti) 🤖
- [ ] Milestones only trigger once
- [ ] Design matches app (no gradients)

### Edge Cases
- [ ] Tutorial works if elements load slowly
- [ ] Can complete flow on mobile
- [ ] Onboarding state syncs across devices
- [ ] Teachers don't see student onboarding
- [ ] Admin can reset any user's onboarding

## Admin Features

### User Management Table

**New Status Column**:
- Shows "New User" badge for incomplete onboarding
- Shows "Onboarded" badge for completed
- Displays milestone count for students

**Reset Onboarding Action**:
- Available in 3-dot menu for each user
- Confirmation dialog before reset
- Resets all onboarding states:
  - `onboarding_completed` → false
  - `has_completed_board_tutorial` → false
  - `milestones_achieved` → []
- Logs action in `admin_audit_logs`

## Troubleshooting

**Welcome dialog not showing?**
- Clear localStorage: `localStorage.removeItem('onboarding_completed_v1')`
- Check database: `onboarding_completed` should be `false`
- Sign out and back in

**Tutorial not appearing on first board?**
- Clear localStorage: `localStorage.removeItem('board_tutorial_completed')`
- Check database: `has_completed_board_tutorial` should be `false`
- Refresh the board page

**Celebrations not firing?**
- Check `milestones_achieved` array in profiles table
- Ensure you're logged in as a student
- Open browser console to check for errors

**Status not updating in admin panel?**
- Refresh the page
- Check if reset query succeeded in network tab

## Database Queries (for debugging)

```sql
-- Check your onboarding status
SELECT
  email,
  onboarding_completed,
  has_completed_board_tutorial,
  milestones_achieved
FROM profiles
WHERE email = 'your@email.com';

-- Reset specific user
UPDATE profiles
SET
  onboarding_completed = false,
  onboarding_completed_at = null,
  has_completed_board_tutorial = false,
  milestones_achieved = '[]'
WHERE email = 'your@email.com';

-- See all user onboarding states
SELECT
  email,
  role,
  onboarding_completed,
  array_length(milestones_achieved, 1) as milestone_count
FROM profiles
ORDER BY created_at DESC;
```

## Expected Behavior

### New Student Journey
1. Signs up → Welcome dialog immediately
2. Completes welcome → See progress checklist
3. Creates first board → Celebration + tutorial
4. Completes tutorial → No more tutorial
5. Uses AI → First AI celebration
6. Joins class → First class celebration
7. All milestones complete → Progress checklist hidden

### Returning Student
- No welcome dialog
- Progress checklist if incomplete
- No tutorial on new boards
- No repeat celebrations
- Can still access features normally
