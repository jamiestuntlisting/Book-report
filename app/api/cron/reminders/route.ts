import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/lib/db";
import { issueMagicToken } from "@/lib/auth/tokens";
import { sendSms, isTwilioConfigured } from "@/lib/sms/twilio";
import { isEmailConfigured, magicLinkEmail, sendEmail } from "@/lib/email";
import { publicEnv } from "@/lib/env";

export const maxDuration = 300;

// Weekly reminder: nudges opted-in storytellers to add a story, with a login
// link. Triggered by the Worker's cron schedule; guarded by CRON_SECRET.
//
// - SMS channel: texts a rotating starter prompt + a one-tap login link. For
//   accounts with an email we mint a real magic link; phone-only accounts get
//   the /login URL (their texted-code login is already two taps).
// - Email channel: sends our magic-link email.

const PROMPTS = [
  "What's a stunt you're really proud of?",
  "Tell the story of a recent day on set.",
  "Who taught you the most in this business?",
  "What's the biggest gag you've ever done?",
  "What almost went wrong — and didn't?",
  "What would you be doing if you didn't do stunts?",
];

async function mintLoginLink(email: string): Promise<string> {
  const token = await issueMagicToken(email);
  return `${publicEnv.appUrl}/auth/callback?token=${token}&email=${encodeURIComponent(
    email.toLowerCase(),
  )}&next=${encodeURIComponent("/dashboard")}`;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const profiles = await db
    .select({
      id: tables.profiles.id,
      email: tables.profiles.email,
      phone: tables.profiles.phone,
      reminder_channel: tables.profiles.reminder_channel,
    })
    .from(tables.profiles)
    .where(eq(tables.profiles.reminder_opt_in, true));

  // Rotate the prompt by ISO week so everyone gets variety without state.
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = PROMPTS[week % PROMPTS.length];

  let sent = 0;
  const failures: string[] = [];

  for (const p of profiles) {
    try {
      if (p.reminder_channel === "sms" && p.phone && isTwilioConfigured()) {
        const loginUrl = p.email
          ? await mintLoginLink(p.email)
          : `${publicEnv.appUrl}/login`;
        const result = await sendSms(
          p.phone,
          `Stunt Biographies: got a minute? ${prompt} Tell it here: ${loginUrl}`,
        );
        if (!result.ok) throw new Error(result.error);
        sent++;
      } else if (p.email && isEmailConfigured()) {
        // Email fallback (also used when channel is 'email' or SMS is
        // unconfigured).
        const link = await mintLoginLink(p.email);
        const content = magicLinkEmail(link);
        const result = await sendEmail({
          to: p.email,
          subject: `Got a minute? ${prompt}`,
          html: `<p style="font-family:Georgia,serif;font-size:16px">${prompt}</p>${content.html}`,
          text: `${prompt}\n\n${content.text}`,
        });
        if (!result.ok) throw new Error(result.error);
        sent++;
      }
    } catch (err) {
      failures.push(
        `${p.id}: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
  }

  return NextResponse.json({
    sent,
    total: profiles.length,
    prompt,
    failures,
  });
}
