import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log environment variable status (without exposing values)
console.log('[SUPABASE] URL configured:', !!supabaseUrl, supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING');
console.log('[SUPABASE] Key configured:', !!supabaseAnonKey, supabaseAnonKey ? 'yes (hidden)' : 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE] CRITICAL: Missing environment variables!');
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

// Quick connectivity test
(async () => {
  try {
    console.log('[SUPABASE] Testing connection...');
    const start = Date.now();
    const { error } = await supabase.from('profiles').select('count').limit(1).maybeSingle();
    const elapsed = Date.now() - start;
    if (error) {
      console.error('[SUPABASE] Connection test failed:', error.message, `(${elapsed}ms)`);
    } else {
      console.log('[SUPABASE] Connection OK:', `${elapsed}ms`);
    }
  } catch (e) {
    console.error('[SUPABASE] Connection test exception:', e);
  }
})();
