import OpenAI from "openai";
import { serverEnv } from "@/lib/env";
import { extFromMime } from "@/lib/utils";
import { glossaryWhisperPrompt } from "@/lib/stunt-glossary";
import type { Transcriber, TranscriptionInput, TranscriptionResult } from "./index";

// Default transcription via OpenAI Whisper. Fetches the media from a signed URL
// and sends it to the transcription endpoint, requesting segment timings so the
// UI can highlight along with playback.
export const whisperTranscriber: Transcriber = {
  name: "openai-whisper",
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const client = new OpenAI({ apiKey: serverEnv.openaiApiKey });

    const res = await fetch(input.mediaUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch media for transcription (${res.status}).`);
    }
    const blob = await res.blob();
    const ext = extFromMime(input.mimeType);
    const fileName = input.fileName ?? `recording.${ext}`;
    const file = new File([blob], fileName, {
      type: input.mimeType ?? blob.type ?? "application/octet-stream",
    });

    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      // Bias decoding toward stunt-industry vocabulary ("jerk vest", "stunt
      // rigging", …) that ASR otherwise garbles.
      prompt: glossaryWhisperPrompt(),
    });

    const verbose = result as unknown as {
      text: string;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    return {
      text: verbose.text ?? "",
      language: verbose.language,
      segments: verbose.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      })),
      provider: "openai-whisper",
    };
  },
};
