import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getUser } from "@/lib/auth/session";
import { getDb, tables } from "@/lib/db";
import { getBindings } from "@/lib/cf";
import { getTranscriber } from "@/lib/transcription";
import { mediaKey } from "@/lib/media";
import { createJob, updateJob } from "@/lib/jobs";

export const maxDuration = 300;

const schema = z.object({ recordingId: z.string().uuid() });

// Transcribes a recording: reads the media from R2, runs the configured
// Transcriber, stores the transcript, and returns it. Ownership is verified
// via the session before any write.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getDb();

  const [recording] = await db
    .select()
    .from(tables.recordings)
    .where(
      and(
        eq(tables.recordings.id, parsed.data.recordingId),
        eq(tables.recordings.user_id, user.id),
      ),
    )
    .limit(1);
  if (!recording) {
    return NextResponse.json({ error: "recording not found" }, { status: 404 });
  }

  const jobId = await createJob(db, {
    userId: user.id,
    kind: "transcribe",
    refTable: "recordings",
    refId: recording.id,
  });
  await updateJob(db, jobId, { status: "running" });

  // Insert a transcript row in 'running' state.
  const [transcriptRow] = await db
    .insert(tables.transcripts)
    .values({
      user_id: user.id,
      recording_id: recording.id,
      status: "running",
    })
    .returning({ id: tables.transcripts.id });

  try {
    const object = await getBindings().MEDIA.get(
      mediaKey(recording.storage_bucket, recording.storage_path),
    );
    if (!object) throw new Error("media file not found in storage");
    const media = (await object.blob()) as unknown as Blob;

    const transcriber = getTranscriber();
    const result = await transcriber.transcribe({
      media,
      mimeType: recording.mime_type,
    });

    await db
      .update(tables.transcripts)
      .set({
        provider: result.provider,
        language: result.language ?? null,
        text: result.text,
        segments: result.segments ?? null,
        status: "done",
      })
      .where(eq(tables.transcripts.id, transcriptRow.id));

    await db
      .update(tables.stories)
      .set({ status: "draft", updated_at: new Date().toISOString() })
      .where(eq(tables.stories.id, recording.story_id));

    await updateJob(db, jobId, { status: "done" });

    return NextResponse.json({
      transcriptId: transcriptRow.id,
      text: result.text,
      language: result.language,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    await db
      .update(tables.transcripts)
      .set({ status: "error", error: message })
      .where(eq(tables.transcripts.id, transcriptRow.id));
    await updateJob(db, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
