import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// Server client — anon key, but wired to the request's auth cookies so it acts
// as the logged-in user and respects RLS. Use in Server Components, Server
// Actions, and Route Handlers for user-scoped reads/writes.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only.
            // Session refresh is handled by middleware, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** Returns the authenticated user or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
