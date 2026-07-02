import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSms, isTwilioConfigured } from "@/lib/sms/twilio";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

// Weekly reminder: nudges opted-in storytellers to add a story, with a login
// link. Triggered by Vercel Cron (see vercel.json); guarded by CRON_SECRET.
//
// - SMS channel: texts a rotating starter prompt + a one-tap login link. For
//   accounts with an email we mint a real magic link; phone-only accounts get
//   the /login URL (their texted-code login is already two taps).
// - Email channel: server-side signInWithOtp sends Supabase's magic-link email.

const PROMPTS = [
  "What's a stunt you're really proud of?",
  "Tell the story of a recent day on set.",
  "Who taught you the most in this business?",
  "What's the biggest gag you've ever done?",
  "What almost went wrong — and didn't?",
  "What would you be doing if you didn't do stunts?",
];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, phone, reminder_channel")
    .eq("reminder_opt_in", true);

  // Rotate the prompt by ISO week so everyone gets variety without state.
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = PROMPTS[week % PROMPTS.length];

  let sent = 0;
  const failures: string[] = [];

  for (const p of profiles ?? []) {
    try {
      if (p.reminder_channel === "sms" && p.phone && isTwilioConfigured()) {
        let loginUrl = `${publicEnv.appUrl}/login`;
        if (p.email) {
          const { data: link } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email: p.email,
            options: { redirectTo: `${publicEnv.appUrl}/dashboard` },
          });
          if (link?.properties?.action_link) loginUrl = link.properties.action_link;
        }
        const result = await sendSms(
          p.phone,
          `Stuntman Stories: got a minute? ${prompt} Tell it here: ${loginUrl}`,
        );
        if (!result.ok) throw new Error(result.error);
        sent++;
      } else if (p.email) {
        // Email fallback (also used when channel is 'email' or SMS is
        // unconfigured): Supabase sends its magic-link email.
        const { error } = await admin.auth.signInWithOtp({
          email: p.email,
          options: {
            emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/dashboard`,
            shouldCreateUser: false,
          },
        });
        if (error) throw new Error(error.message);
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
    total: profiles?.length ?? 0,
    prompt,
    failures,
  });
}
