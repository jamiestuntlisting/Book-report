import type { TranscriptSegment } from "@/lib/types";
import { whisperTranscriber } from "./whisper";

export interface TranscriptionResult {
  text: string;
  language?: string;
  segments?: TranscriptSegment[];
  provider: string;
}

export interface TranscriptionInput {
  /** A publicly-fetchable (signed) URL to the media file. */
  mediaUrl: string;
  mimeType?: string | null;
  fileName?: string;
}

export interface Transcriber {
  readonly name: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

// Swap the default provider here (Deepgram, AssemblyAI, a Supabase Edge
// Function, etc.) — callers depend only on the Transcriber interface.
export function getTranscriber(): Transcriber {
  return whisperTranscriber;
}
