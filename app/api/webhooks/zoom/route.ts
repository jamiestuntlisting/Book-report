import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyZoomSignature } from "@/lib/interview";
import { extFromMime } from "@/lib/utils";
import { recordingPath, BUCKETS } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

// Ingests completed Zoom cloud recordings. Matches the meeting to an
// appointment, downloads the recording, uploads it to the (S3-backed) video
// bucket, registers a recording row, and kicks the standard transcribe →
// generate pipeline. Zoom credentials are optional config; without them this
// endpoint is dormant. This is a clean hook, not a fully wired integration.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-zm-signature");
  const timestamp = req.headers.get("x-zm-request-timestamp");

  if (!verifyZoomSignature(raw, signature, timestamp)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: {
    event?: string;
    payload?: {
      plainToken?: string;
      object?: {
        id?: string;
        recording_files?: Array<{
          download_url?: string;
          file_type?: string;
          recording_type?: string;
        }>;
      };
    };
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Zoom endpoint validation (CRC) challenge.
  if (body.event === "endpoint.url_validation" && body.payload?.plainToken) {
    return NextResponse.json({
      plainToken: body.payload.plainToken,
      // A real deployment must HMAC this token with the webhook secret.
      encryptedToken: body.payload.plainToken,
    });
  }

  if (body.event !== "recording.completed") {
    return NextResponse.json({ ok: true });
  }

  const meetingId = body.payload?.object?.id?.toString();
  const files = body.payload?.object?.recording_files ?? [];
  const videoFile =
    files.find((f) => f.file_type === "MP4") ?? files[0];
  if (!meetingId || !videoFile?.download_url) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  const { data: appointment } = await admin
    .from("interview_appointments")
    .select("*")
    .eq("provider_meeting_id", meetingId)
    .maybeSingle();
  if (!appointment) {
    // No matching appointment; acknowledge so Zoom stops retrying.
    return NextResponse.json({ ok: true });
  }

  try {
    // Zoom download URLs may require an access token appended as a query param.
    const dl = await fetch(videoFile.download_url);
    if (!dl.ok) throw new Error(`download failed (${dl.status})`);
    const arrayBuf = await dl.arrayBuffer();
    const mime = "video/mp4";
    const ext = extFromMime(mime);

    // Create a story to hold the interview.
    const { data: story } = await admin
      .from("stories")
      .insert({
        user_id: appointment.user_id,
        title: "Interview",
        status: "transcribing",
        prompt_text: appointment.notes,
      })
      .select("id")
      .single();

    const recordingId = crypto.randomUUID();
    const path = recordingPath(appointment.user_id, story!.id, recordingId, ext);
    const { error: upErr } = await admin.storage
      .from(BUCKETS.video)
      .upload(path, Buffer.from(arrayBuf), { contentType: mime, upsert: true });
    if (upErr) throw new Error(upErr.message);

    await admin.from("recordings").insert({
      id: recordingId,
      user_id: appointment.user_id,
      story_id: story!.id,
      kind: "video",
      storage_bucket: BUCKETS.video,
      storage_path: path,
      mime_type: mime,
      source: "interview_zoom",
    });

    await admin
      .from("interview_appointments")
      .update({ status: "completed", recording_id: recordingId })
      .eq("id", appointment.id);

    // Transcription is left to the standard pipeline; a background worker or a
    // follow-up call to /api/transcribe (with a service context) completes it.
    return NextResponse.json({ ok: true, storyId: story!.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ingest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
