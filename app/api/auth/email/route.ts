import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { issueMagicToken } from "@/lib/auth/tokens";
import { isEmailConfigured, magicLinkEmail, sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  next: z.string().startsWith("/").catch("/dashboard"),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email sign-in isn't set up yet (missing RESEND_API_KEY)." },
      { status: 503 },
    );
  }

  const { email, next } = parsed.data;
  const token = await issueMagicToken(email);
  const link = `${publicEnv.appUrl}/auth/callback?token=${token}&email=${encodeURIComponent(
    email.toLowerCase(),
  )}&next=${encodeURIComponent(next)}`;

  const content = magicLinkEmail(link);
  const sent = await sendEmail({ to: email, ...content });
  if (!sent.ok) {
    console.error("magic link email failed:", sent.error);
    return NextResponse.json(
      { error: "Couldn't send the email — try again in a minute." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
