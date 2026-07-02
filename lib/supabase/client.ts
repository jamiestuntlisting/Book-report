"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Browser client — uses the anon key and respects RLS. Safe to ship to the
// client. Used for auth and direct-to-Storage uploads via signed URLs.
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
