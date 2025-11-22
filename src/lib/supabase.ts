import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // This check ensures we don't crash on build time if envs are missing,
  // but warns in development.
  if (typeof window !== 'undefined') {
     console.warn('Missing Supabase environment variables. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file.');
  }
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

