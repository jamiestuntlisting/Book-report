import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { ensureVoiceProfile, getActiveVoiceProfile } from "@/lib/generation";

export const maxDuration = 120;

// Rebuilds the user's voice-style profile from all their transcripts. Called
// implicitly during chapter generation, and available for a manual refresh.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const profile = await ensureVoiceProfile(getDb(), user.id);
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await getActiveVoiceProfile(getDb(), user.id);
  return NextResponse.json({ profile });
}
