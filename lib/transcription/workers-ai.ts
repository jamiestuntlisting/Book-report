import { getBindings } from "@/lib/cf";
import { glossaryWhisperPrompt } from "@/lib/stunt-glossary";
import type { Transcriber, TranscriptionInput, TranscriptionResult } from "./index";

// Transcription via Cloudflare Workers AI running whisper-large-v3-turbo —
// the same open-source Whisper family OpenAI serves, one generation newer.
// No external account needed; usage draws on the Workers AI allowance.

const MODEL = "@cf/openai/whisper-large-v3-turbo";

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

interface WhisperTurboOutput {
  text?: string;
  transcription_info?: { language?: string };
  segments?: Array<{ start: number; end: number; text: string }>;
}

export const workersAiTranscriber: Transcriber = {
  name: "workers-ai-whisper",
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const { AI } = getBindings();
    if (!AI) throw new Error("Workers AI binding missing");

    const audio = toBase64(await input.media.arrayBuffer());
    const result = (await (
      AI as unknown as {
        run(model: string, options: Record<string, unknown>): Promise<unknown>;
      }
    ).run(MODEL, {
      audio,
      task: "transcribe",
      // Bias decoding toward stunt-industry vocabulary ("jerk vest", "stunt
      // rigging", …) that ASR otherwise garbles.
      initial_prompt: glossaryWhisperPrompt(),
    })) as WhisperTurboOutput;

    return {
      text: result.text ?? "",
      language: result.transcription_info?.language,
      segments: result.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      })),
      provider: "workers-ai-whisper",
    };
  },
};
