import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser, createClient } from "@/lib/supabase/server";
import { getTranscriber } from "@/lib/transcription";
import { signedReadUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJob, updateJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({ recordingId: z.string().uuid() });

// Transcribes a recording: signs a read URL, runs the configured Transcriber,
// stores the transcript, and returns it. Ownership is verified via the session
// before any privileged write.
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: recording } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", parsed.data.recordingId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!recording) {
    return NextResponse.json({ error: "recording not found" }, { status: 404 });
  }

  const jobId = await createJob(admin, {
    userId: user.id,
    kind: "transcribe",
    refTable: "recordings",
    refId: recording.id,
  });
  await updateJob(admin, jobId, { status: "running" });

  // Upsert a transcript row in 'running' state.
  const { data: transcriptRow } = await supabase
    .from("transcripts")
    .insert({
      user_id: user.id,
      recording_id: recording.id,
      status: "running",
    })
    .select("id")
    .single();

  try {
    const mediaUrl = await signedReadUrl(
      supabase,
      recording.storage_bucket,
      recording.storage_path,
    );
    if (!mediaUrl) throw new Error("could not sign media URL");

    const transcriber = getTranscriber();
    const result = await transcriber.transcribe({
      mediaUrl,
      mimeType: recording.mime_type,
    });

    await supabase
      .from("transcripts")
      .update({
        provider: result.provider,
        language: result.language ?? null,
        text: result.text,
        segments: result.segments ?? null,
        status: "done",
      })
      .eq("id", transcriptRow!.id);

    await supabase
      .from("stories")
      .update({ status: "draft" })
      .eq("id", recording.story_id);

    await updateJob(admin, jobId, { status: "done" });

    return NextResponse.json({
      transcriptId: transcriptRow!.id,
      text: result.text,
      language: result.language,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    await supabase
      .from("transcripts")
      .update({ status: "error", error: message })
      .eq("id", transcriptRow!.id);
    await updateJob(admin, jobId, { status: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
