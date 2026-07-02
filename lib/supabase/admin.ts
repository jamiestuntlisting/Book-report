import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

// Service-role client — BYPASSES RLS. Server-only. This is the security
// boundary: never import this into a Client Component, and always verify the
// caller owns the resource (via the session client) before using it to write.
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
