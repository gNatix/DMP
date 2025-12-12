import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variable status (without exposing values)
console.log('[SUPABASE] URL configured:', !!supabaseUrl, supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING');
console.log('[SUPABASE] Key configured:', !!supabaseAnonKey, supabaseAnonKey ? 'yes (hidden)' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] CRITICAL: Missing environment variables!');
  console.error('[SUPABASE] Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
