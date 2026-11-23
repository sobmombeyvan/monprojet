import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Anonymous client WITHOUT cookies — for public data (published countries, services,
 * experts, articles) that is identical for every visitor and can therefore be cached
 * (see src/lib/data/queries.ts). RLS still applies with the `anon` role.
 */
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}

/** Cache tag for all public data — invalidated by every admin / consultant change. */
export const PUBLIC_DATA_TAG = "public-data";
