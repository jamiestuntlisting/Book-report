import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { consumeToken } from "@/lib/auth/tokens";
import {
  SESSION_COOKIE,
  createSession,
  getOrCreateUser,
  sessionCookieOptions,
} from "@/lib/auth/session";

const bodySchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const { phone, code } = parsed.data;
  const identifier = await consumeToken("sms", phone, code);
  if (!identifier) {
    return NextResponse.json(
      { error: "That code didn't match or has expired." },
      { status: 401 },
    );
  }

  const user = await getOrCreateUser({ phone: identifier });
  const cookieValue = await createSession(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, cookieValue, sessionCookieOptions());
  return response;
}
