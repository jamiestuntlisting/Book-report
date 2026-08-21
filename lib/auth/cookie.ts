// Session-cookie naming, signing, and parsing. Deliberately free of DB or
// Cloudflare-context imports so the middleware can use it in the edge bundle.
import { hmacSign, hmacVerify } from "./crypto";

export const SESSION_COOKIE = "ss_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing required environment variable: AUTH_SECRET");
  return secret;
}

/** Cookie value is "<sessionId>.<hmac>". */
export async function sessionCookieValue(sessionId: string): Promise<string> {
  const sig = await hmacSign(authSecret(), sessionId);
  return `${sessionId}.${sig}`;
}

/** Returns the sessionId if the cookie's signature checks out, else null. */
export async function parseSessionCookie(
  value: string | undefined,
): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const ok = await hmacVerify(authSecret(), sessionId, sig);
  return ok ? sessionId : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}
