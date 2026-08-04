import type { TranscriptSegment } from "@/lib/types";
import { getBindings } from "@/lib/cf";
import { whisperTranscriber } from "./whisper";
import { workersAiTranscriber } from "./workers-ai";

export interface TranscriptionResult {
  text: string;
  language?: string;
  segments?: TranscriptSegment[];
  provider: string;
}

export interface TranscriptionInput {
  /** The media bytes (read from R2). */
  media: Blob;
  mimeType?: string | null;
  fileName?: string;
}

export interface Transcriber {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

// Default: Cloudflare Workers AI (whisper-large-v3-turbo) — no external
// account needed. Falls back to the OpenAI Whisper API when an
// OPENAI_API_KEY is configured but the AI binding is absent (e.g. plain
// `next dev` without wrangler).
export function getTranscriber(): Transcriber {
  const { AI } = getBindings();
  if (AI) return workersAiTranscriber;
  if (process.env.OPENAI_API_KEY) return whisperTranscriber;
  throw new Error(
    "No transcription backend available: needs the Workers AI binding or OPENAI_API_KEY.",
  );
}
