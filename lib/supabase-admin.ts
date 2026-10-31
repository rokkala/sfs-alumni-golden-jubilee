import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function cleanEnv(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export function createAdminClient(): SupabaseClient {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next.js caches fetch() by default; an early empty committee response
      // was sticking on Vercel while anon (different URL/headers) stayed fresh.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
