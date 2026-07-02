import { NextResponse, type NextRequest } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns the ids of all completed transcripts for a story — used by the
// "merge in new memos" action to re-integrate everything recorded.
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const storyId = req.nextUrl.searchParams.get("storyId");
  if (!storyId) return NextResponse.json({ ids: [] });

  const supabase = await createClient();
  const { data: recordings } = await supabase
    .from("recordings")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", user.id);
  const recIds = (recordings ?? []).map((r) => r.id);
  if (!recIds.length) return NextResponse.json({ ids: [] });

  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("id")
    .in("recording_id", recIds)
    .eq("status", "done");

  return NextResponse.json({ ids: (transcripts ?? []).map((t) => t.id) });
}
