import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Lazily creates a browser Supabase client.
 * Returns null during build/SSR so Next/Vercel doesn't crash on prerender.
 */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    // In prod, this usually means Vercel env vars aren't set.
    console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return null;
  }

  _client = createClient(url, anon);
  return _client;
}
