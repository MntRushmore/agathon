# Authentication Testing Guide

## System Status ✅

**Authentication:** ENABLED
**Next.js:** Running on http://localhost:3000 and http://10.0.0.95:3000
**Database:** Connected to Supabase
**All Tables:** Created and ready

---

## Test Flow 1: Teacher Creates Class

### Step 1: Sign Up as Teacher
1. Open browser: http://localhost:3000
2. You should be redirected to sign up page
3. Fill in the form:
   - Email: teacher@test.com
   - Password: testpass123
   - Full Name: Test Teacher
   - **Role: Teacher** ← Important!
4. Click "Sign Up"
5. Should redirect to dashboard

### Step 2: Create Your First Class
1. Click "My Classes" or navigate to `/teacher/classes`
2. Click "+ New Class" button
3. Fill in the form:
   - **Class Name:** Math 101 (required)
   - **Subject:** Math
   - **Grade Level:** Grade 8
   - **Description:** Algebra fundamentals
4. Click "Create Class"
5. **Success toast should show join code** (e.g., "ABC123")
6. Class card should appear in grid

### Step 3: View Class Details
1. Click on the class card
2. Should see:
   - Class name, subject, grade level
   - Join code with copy button
   - Two tabs: Students | Assignments
   - Students tab shows "No students yet"
   - Assignments tab shows "No assignments yet"

### Step 4: Copy Join Code
1. Click the "Copy" button next to join code
2. Toast should confirm: "Join code ABC123 copied to clipboard"
3. Save this code for student enrollment test

**Expected Result:** ✅ Teacher can create classes and get join codes

---

## Test Flow 2: Student Joins Class

### Step 1: Sign Up as Student (New Browser/Incognito)
1. Open **incognito/private window**
2. Go to http://localhost:3000
3. Sign up with:
   - Email: student1@test.com
   - Password: testpass123
   - Full Name: John Doe
   - **Role: Student** ← Important!
4. Should redirect to dashboard

### Step 2: Join a Class
1. Navigate to "Join a Class" or go to `/student/join`
2. Enter the join code from teacher (e.g., ABC123)
3. Click "Join Class"
4. Success toast: "Successfully joined Math 101"
5. Class should appear in "Your Classes" section

### Step 3: Verify Enrollment
1. Click on the enrolled class
2. Should redirect to dashboard
3. Eventually will show "My Assignments" tab

**Expected Result:** ✅ Student can join using join code

---

## Test Flow 3: Teacher Sees Student in Roster

### Step 1: Return to Teacher Window
1. Go back to teacher's browser window
2. Navigate to the class detail page
3. Refresh the page if needed

### Step 2: Check Roster
1. Click "Students" tab
2. Should see:
   - John Doe in the table
   - Email: student1@test.com
   - Avatar with initials "JD"
   - "Joined X seconds ago"
   - Actions dropdown (⋮)

### Step 3: Test Remove Student
1. Click the (⋮) button next to student
2. Click "Remove from class"
3. Confirm the dialog
4. Student should disappear from roster
5. Success toast: "John Doe has been removed from the class"

### Step 4: Student Re-joins
1. Go back to student window
2. Refresh the page
3. Go to "Join a Class"
4. Re-enter the join code
5. Should join successfully again

**Expected Result:** ✅ Roster updates in real-time, removal works

---

## Test Flow 4: Multiple Students

### Repeat for 2-3 more students:
1. Open new incognito windows
2. Sign up as:
   - student2@test.com (Jane Smith)
   - student3@test.com (Bob Johnson)
3. Each joins using the join code
4. Teacher sees all 3 students in roster
5. Student count badge shows correct number

**Expected Result:** ✅ Multiple students can join the same class

---

## Test Flow 5: Multiple Classes

### In Teacher Window:
1. Create 2-3 more classes:
   - Science 8
   - ELA 9
   - History 10
2. Each gets unique join code
3. All appear in grid view
4. Can toggle to list view
5. Search works (try searching "Science")

**Expected Result:** ✅ Teacher can manage multiple classes

---

## Common Issues & Solutions

### Issue: "Not authenticated" error
**Solution:** Make sure you're signed in. Refresh and check if redirected to login.

### Issue: "Row Level Security policy violation"
**Solution:**
1. Check you signed up with correct role (teacher/student)
2. Verify RLS policies in Supabase dashboard
3. Re-run migrations if needed

### Issue: Join code not found
**Solution:**
1. Make sure join code is exactly 6 characters
2. Check it's from an active class
3. Try creating a new class

### Issue: Student doesn't appear in roster
**Solution:**
1. Refresh the class detail page
2. Check student actually joined (should see success toast)
3. Query database: `SELECT * FROM class_members;`

### Issue: Can't create class
**Solution:**
1. Check browser console for errors
2. Verify Supabase credentials in `.env.local`
3. Make sure you're signed in as a teacher

---

## Database Verification

### Check Tables Have Data:

```sql
-- See all users
SELECT * FROM profiles;

-- See all classes
SELECT * FROM classes;

-- See all enrollments
SELECT cm.*, p.full_name, p.email
FROM class_members cm
JOIN profiles p ON p.id = cm.student_id;

-- See join code for a class
SELECT name, join_code FROM classes;
```

### Access Database:
```bash
psql "postgresql://postgres:xae1bgc-qhz-VQZ_xrx@db.isrckjwuybjzgffkgeey.supabase.co:5432/postgres"
```

---

## Success Checklist

After testing, verify:

- ✅ Teachers can sign up
- ✅ Teachers can create classes
- ✅ Join codes are generated (6 chars)
- ✅ Students can sign up
- ✅ Students can join with code
- ✅ Students appear in teacher's roster
- ✅ Teacher can remove students
- ✅ Students can re-join
- ✅ Multiple students work
- ✅ Multiple classes work
- ✅ Search and filters work
- ✅ Grid/list view toggle works
- ✅ All data persists in database

---

## iPad Testing

### Once Web Testing is Complete:

1. Make sure Next.js is running with network binding:
   ```bash
   npm run dev -- -H 0.0.0.0
   ```

2. Update WebView if needed (should be localhost):
   ```
   expo-app/components/WebViewWrapper.tsx
   const WEB_APP_URL = 'http://localhost:3000'
   ```

3. Start Expo:
   ```bash
   cd expo-app
   npx expo start
   ```

4. Press 'i' for iOS Simulator (iPad Air 11-inch)

5. Test full flow on iPad:
   - Sign up as teacher
   - Create class
   - Copy join code
   - Sign up as student (different session)
   - Join class
   - Verify roster

---

## What to Test Next (After Sprint 4)

Once assignments are implemented:
- ✅ Teacher creates assignment from board
- ✅ Assignment appears in class detail
- ✅ Students get their own board copy
- ✅ Student can submit assignment
- ✅ Teacher sees submission status
- ✅ Progress tracking works

---

## Notes

- **Auth is now ENABLED** - temp boards won't work without signing in
- All educational features now work with real data
- RLS policies enforce permissions
- Data persists in Supabase
- Ready for Sprint 4: Assignment Creation

**Current Network IP:** 10.0.0.95:3000
**Update WebView if IP changed:** Check `expo-app/components/WebViewWrapper.tsx`

---

**Ready to test!** 🚀

Start with Test Flow 1 (Teacher Creates Class) and work through each flow.
