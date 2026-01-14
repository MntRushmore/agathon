/**
 * Supabase Client Exports
 *
 * Use createClient() for client-side operations (components, client APIs)
 * Use createServerSupabaseClient() for server-side operations (Server Components, Route Handlers)
 */

export { createClient } from './client';
export { createServerSupabaseClient, getUser, getUserProfile } from './server';
