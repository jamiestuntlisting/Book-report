import { NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";
import { ensureVoiceProfile, getActiveVoiceProfile } from "@/lib/generation";

export const runtime = "nodejs";
export const maxDuration = 120;

// Rebuilds the user's voice-style profile from all their transcripts. Called
// implicitly during chapter generation, and available for a manual refresh.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  try {
    const profile = await ensureVoiceProfile(supabase, user.id);
    return NextResponse.json({ profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const profile = await getActiveVoiceProfile(supabase, user.id);
  return NextResponse.json({ profile });
}
