import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getUser, createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

const createSchema = z.object({
  scope: z.enum(["book", "story"]).default("book"),
  storyId: z.string().uuid().optional(),
});

// Creates a public, read-only share link (a random token). Revoke via DELETE.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const supabase = await createClient();
  const token = nanoid(16);
  const { error } = await supabase.from("shares").insert({
    user_id: user.id,
    token,
    scope: parsed.data.scope,
    story_id: parsed.data.storyId ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token, url: `${publicEnv.appUrl}/share/${token}` });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const supabase = await createClient();
  await supabase.from("shares").update({ revoked: true }).eq("token", token).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
