# Authentication Setup Guide

This guide will walk you through setting up authentication for your AI Whiteboard application.

## Prerequisites

- A Supabase account ([sign up at supabase.com](https://supabase.com))
- Your Supabase project URL and anon key

## Step 1: Run the Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the sidebar
3. Open the file `supabase-setup.sql` from your project root
4. Copy and paste the entire contents into the SQL Editor
5. Click **Run** to execute the migration

This will:
- Create the `profiles` table for user data
- Add `user_id` column to `whiteboards` table
- Create `board_shares` table for collaboration
- Set up Row Level Security (RLS) policies
- Create triggers for automatic profile creation

## Step 2: Enable Authentication Providers

### Email/Password Authentication (Already Enabled)
Email authentication is enabled by default in Supabase.

### Google OAuth Setup

1. Go to your Supabase project dashboard
2. Navigate to **Authentication > Providers**
3. Find **Google** in the list and click on it
4. Toggle **Enable Sign in with Google**

#### Create Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application** as the application type
6. Add these Authorized redirect URIs:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback (for local development)
   ```
7. Copy the **Client ID** and **Client Secret**
8. Paste them into your Supabase Google provider settings
9. Click **Save**

## Step 3: Environment Variables

Make sure your `.env.local` file has the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# AI API Keys (existing variables)
NEXT_PUBLIC_OPENROUTER_API_KEY=your-openrouter-key
MISTRAL_API_KEY=your-mistral-key
OPENAI_API_KEY=your-openai-key
```

## Step 4: Update Site URL (Production Only)

When deploying to production:

1. Go to **Authentication > URL Configuration**
2. Set **Site URL** to your production domain (e.g., `https://yourapp.com`)
3. Add your production URL to **Redirect URLs**:
   ```
   https://yourapp.com/auth/callback
   ```

## Step 5: Test the Authentication Flow

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000

3. You should see a "Sign in to get started" screen

4. Try creating an account:
   - Click "Sign Up" tab
   - Fill in your details
   - Select "Student" or "Teacher" role
   - Submit the form
   - Check your email for verification link (development mode may skip this)

5. Try signing in with Google:
   - Click "Continue with Google"
   - Select your Google account
   - Authorize the application

6. After signing in, you should be able to:
   - See "My Whiteboards" dashboard
   - Create new boards
   - Access your boards (only yours, not other users')
   - Sign out from the user menu

## Step 6: Set User Roles (Optional)

By default, all new users are created with the "student" role. To make a user a teacher:

1. Go to **Authentication > Users** in Supabase
2. Find the user you want to promote
3. Go to **Table Editor > profiles**
4. Find the user's profile row
5. Change the `role` column from `student` to `teacher`

Teachers have additional permissions:
- Can view all whiteboards (for grading/monitoring)
- Can see all student profiles

## Step 7: Migrate Existing Boards (If Applicable)

If you have existing whiteboards created before authentication:

1. Go to **SQL Editor** in Supabase
2. Run this query to assign existing boards to a user:
   ```sql
   -- Replace 'USER_UUID_HERE' with a valid user ID from the profiles table
   UPDATE whiteboards
   SET user_id = 'USER_UUID_HERE'
   WHERE user_id IS NULL;
   ```

3. Or delete orphaned boards:
   ```sql
   DELETE FROM whiteboards WHERE user_id IS NULL;
   ```

## Troubleshooting

### "Email not confirmed" error
- Check your email for the confirmation link
- In development, you can disable email confirmation in **Authentication > Settings > Email Auth** (set "Enable email confirmations" to OFF)

### Google OAuth not working
- Verify your redirect URIs match exactly
- Check that your Google OAuth credentials are correctly entered in Supabase
- Make sure your Google Cloud Console project has the necessary APIs enabled

### "Row Level Security" errors
- Ensure you ran the full `supabase-setup.sql` script
- Check that RLS policies were created in **Table Editor > whiteboards > Policies**
- Verify the user is authenticated (check browser console for auth state)

### Can't see any boards after signing in
- This is normal if you just set up auth - existing boards don't have user_id set
- Follow Step 7 to migrate existing boards
- Create a new board to test

### User menu not showing
- Make sure `AuthProvider` is wrapped around your app in `layout.tsx`
- Check browser console for errors
- Verify Supabase environment variables are set correctly

## Security Notes

1. **Never commit** your `.env.local` file to git
2. The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in client code - it's protected by RLS policies
3. All API routes should validate the authenticated user before performing actions
4. RLS policies automatically filter data based on the authenticated user
5. Users can only access their own boards (unless explicitly shared)

## Next Steps

With authentication set up, you can now:

1. **Implement board sharing**: Use the `board_shares` table to let users share boards with each other
2. **Add teacher features**: Create assignment templates that teachers can distribute to students
3. **Track progress**: Log student interactions and hint usage for analytics
4. **Add profile customization**: Let users upload avatars and update their profiles

## API Routes and Authentication

All your API routes (generate-solution, check-help-needed, OCR, voice) automatically have access to the authenticated user through Supabase. The RLS policies ensure users can only modify their own data.

Example of getting the authenticated user in an API route:

```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use user.id in your logic
  console.log('Request from user:', user.id);

  // Your existing API logic here...
}
```

## Support

If you encounter any issues:

1. Check the browser console for errors
2. Check the Supabase dashboard logs
3. Review the RLS policies in Table Editor
4. Verify all environment variables are set correctly

Happy whiteboarding! 🎨
