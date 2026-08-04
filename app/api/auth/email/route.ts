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
      { error: friendlySendError(sent.error ?? "") },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}

// Map common Resend failures to actionable messages (this is shown to the
// person on the login page, so keep it human).
function friendlySendError(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes("401") || d.includes("api key is invalid")) {
    return "Email isn't working: the RESEND_API_KEY looks invalid — re-paste it in the worker's settings.";
  }
  if (d.includes("your own email address") || d.includes("verify a domain")) {
    return "Resend's free test sender can only email the address you signed up to Resend with. Sign in with that email, or verify a domain in Resend.";
  }
  if (d.includes("429")) {
    return "Email limit reached for now — try again in a few minutes.";
  }
  return `Couldn't send the email. Resend said: ${detail.slice(0, 160)}`;
}
