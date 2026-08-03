import { NextResponse, type NextRequest } from "next/server";
import { parseSessionCookie, SESSION_COOKIE } from "@/lib/auth/cookie";
import { isAppConfigured } from "@/lib/env";

// Guards the authenticated app shell with a stateless cookie-signature check
// (no DB hit). Pages and API routes still verify the session against D1 via
// getUser()/requireUser(). Public routes are allowed through unauthenticated.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth",
  "/share",
  "/api/auth",
  "/api/webhooks",
  "/api/cron",
  "/api/media", // does its own auth (session, signed URL, or render token)
  "/book/print",
];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  // If secrets aren't configured yet, don't block — let pages render setup help.
  if (!isAppConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const sessionId = await parseSessionCookie(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!sessionId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
