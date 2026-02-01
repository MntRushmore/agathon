import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.'
  );
}

/**
 * Creates a Supabase client for use in client components and API calls
 * This uses browser cookies for auth state management
 */
export function createClient() {
  return createBrowserClient(
    supabaseUrl!,
    supabaseAnonKey!
  );
}
