import { NextResponse, type NextRequest } from "next/server";
import { consumeToken } from "@/lib/auth/tokens";
import {
  SESSION_COOKIE,
  createSession,
  getOrCreateUser,
  sessionCookieOptions,
} from "@/lib/auth/session";

// Handles the magic-link click: verifies the one-time token, creates a
// session, sets the auth cookie, and bounces to the intended destination.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const next = searchParams.get("next") ?? "/dashboard";
  const safeNext = next.startsWith("/") ? next : "/dashboard";

  if (token && email) {
    const identifier = await consumeToken("magic", email, token);
    if (identifier) {
      const user = await getOrCreateUser({ email: identifier });
      const cookieValue = await createSession(user.id);
      const response = NextResponse.redirect(`${origin}${safeNext}`);
      response.cookies.set(SESSION_COOKIE, cookieValue, sessionCookieOptions());
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
