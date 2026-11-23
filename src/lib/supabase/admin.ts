import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Service-role client. BYPASSES RLS — use only in trusted server code
 * (payment webhooks, cron jobs, admin actions after an explicit role check).
 * The `server-only` import makes the build fail if this file reaches a client bundle.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
