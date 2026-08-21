// Session management on D1: 30-day sessions referenced by an HMAC-signed
// HttpOnly cookie. The cookie signature lets the middleware reject junk
// without a DB hit; real authorization always re-checks the sessions table.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  parseSessionCookie,
  sessionCookieOptions,
  sessionCookieValue,
} from "./cookie";

export {
  SESSION_COOKIE,
  parseSessionCookie,
  sessionCookieOptions,
  sessionCookieValue,
};

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
}

/** Creates a session row and returns the signed cookie value to set. */
export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const [row] = await db
    .insert(tables.sessions)
    .values({ user_id: userId, expires_at: expires })
    .returning({ id: tables.sessions.id });
  return sessionCookieValue(row.id);
}

/** Authenticated user for the current request, or null. */
export async function getUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const sessionId = await parseSessionCookie(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  if (!sessionId) return null;

  const db = getDb();
  const nowIso = new Date().toISOString();
  const rows = await db
    .select({
      id: tables.users.id,
      email: tables.users.email,
      phone: tables.users.phone,
    })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.user_id, tables.users.id))
    .where(
      and(
        eq(tables.sessions.id, sessionId),
        gt(tables.sessions.expires_at, nowIso),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Like getUser() but redirects to /login when signed out. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = await parseSessionCookie(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  if (sessionId) {
    await getDb()
      .delete(tables.sessions)
      .where(eq(tables.sessions.id, sessionId));
  }
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Find or create the user for an email/phone identity, provisioning the
 * profile and book settings exactly like the old Supabase signup trigger.
 */
export async function getOrCreateUser(
  identity: { email: string } | { phone: string },
): Promise<AuthUser> {
  const db = getDb();
  const byEmail = "email" in identity;
  const existing = await db
    .select()
    .from(tables.users)
    .where(
      byEmail
        ? eq(tables.users.email, identity.email)
        : eq(tables.users.phone, identity.phone),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const [user] = await db
    .insert(tables.users)
    .values(byEmail ? { email: identity.email } : { phone: identity.phone })
    .returning();

  const displayName = byEmail
    ? identity.email.split("@")[0]
    : "Stunt storyteller";
  await db.insert(tables.profiles).values({
    id: user.id,
    email: byEmail ? identity.email : null,
    phone: byEmail ? null : identity.phone,
    display_name: displayName,
  });
  await db.insert(tables.book_settings).values({ user_id: user.id });

  return user;
}
