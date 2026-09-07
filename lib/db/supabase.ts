/**
 * Supabase server-side client.
 *
 * Claude code — Supabase migration Phase A.
 *
 * Uses service role key for server actions / scripts. Bypasses RLS.
 * Browser client (separate) should use ANON key + RLS policies.
 *
 * Env vars required in `.env.local`:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function getSupabaseConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  // Prefer new-format sb_secret_... key; fall back to legacy service_role JWT.
  // Supabase disabled legacy JWTs in some projects; new format is recommended.
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SECRET_KEY in environment.",
    );
  }
  return { url, key };
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { url, key } = getSupabaseConfig();
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

/**
 * Reset cached client (testing only).
 */
export function __resetSupabaseClientForTest(): void {
  cachedClient = null;
}
