// Transactional email via the Resend HTTP API (no SDK needed). Until a custom
// domain is verified in Resend, the onboarding sender only delivers to the
// Resend account owner's own inbox — fine for a single-author book app.
import { serverEnv } from "@/lib/env";

const FROM_FALLBACK = "Stuntman Stories <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || FROM_FALLBACK,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true };
}

export function magicLinkEmail(link: string) {
  return {
    subject: "Your sign-in link — Stuntman Stories",
    text: `Click to sign in to Stuntman Stories:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't request it, you can ignore this email.`,
    html: `
      <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">Stuntman Stories</h2>
        <p>Click the button below to sign in. The link works once and expires in 15 minutes.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#b45309;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Sign in</a>
        </p>
        <p style="color:#666;font-size:13px">If you didn't request this, ignore this email.</p>
      </div>`,
  };
}
