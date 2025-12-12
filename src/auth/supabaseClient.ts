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

// Raw fetch test to check if Supabase is reachable at all
(async () => {
  if (!supabaseUrl) return;
  
  try {
    console.log('[SUPABASE] Raw fetch test to:', supabaseUrl);
    const start = Date.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey || '',
      },
    });
    const elapsed = Date.now() - start;
    console.log('[SUPABASE] Raw fetch result:', response.status, response.statusText, `(${elapsed}ms)`);
    
    if (response.status === 503) {
      console.error('[SUPABASE] ⚠️ PROJECT IS PAUSED! Go to Supabase dashboard and resume it.');
    }
  } catch (e) {
    console.error('[SUPABASE] Raw fetch FAILED:', e);
  }
})();
