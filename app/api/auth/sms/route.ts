import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { issueSmsCode } from "@/lib/auth/tokens";
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio";

const bodySchema = z.object({
  phone: z.string().regex(/^\+\d{7,15}$/, "Use international format, e.g. +15555555555"),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid phone number." },
      { status: 400 },
    );
  }
  if (!isTwilioConfigured()) {
    return NextResponse.json(
      { error: "Text sign-in isn't set up yet — use email for now." },
      { status: 503 },
    );
  }

  const { phone } = parsed.data;
  const code = await issueSmsCode(phone);
  const sent = await sendSms(
    phone,
    `Your Stunt Biographies sign-in code is ${code}. It expires in 15 minutes.`,
  );
  if (!sent.ok) {
    console.error("sms code failed:", sent.error);
    return NextResponse.json(
      { error: "Couldn't send the text — try again in a minute." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
