import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";

// Returns the ids of all completed transcripts for a story — used by the
// "merge in new memos" action to re-integrate everything recorded.
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const storyId = req.nextUrl.searchParams.get("storyId");
  if (!storyId) return NextResponse.json({ ids: [] });

  const db = getDb();
  const recordings = await db
    .select({ id: tables.recordings.id })
    .from(tables.recordings)
    .where(
      and(
        eq(tables.recordings.story_id, storyId),
        eq(tables.recordings.user_id, user.id),
      ),
    );
  const recIds = recordings.map((r) => r.id);
  if (!recIds.length) return NextResponse.json({ ids: [] });

  const transcripts = await db
    .select({ id: tables.transcripts.id })
    .from(tables.transcripts)
    .where(
      and(
        inArray(tables.transcripts.recording_id, recIds),
        eq(tables.transcripts.status, "done"),
      ),
    );

  return NextResponse.json({ ids: transcripts.map((t) => t.id) });
}
