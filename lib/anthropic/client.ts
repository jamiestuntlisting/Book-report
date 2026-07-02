import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

// Server-only Anthropic client. Model is pinned centrally so every call
// (voice profile, chapter rewrite, regenerate, append) stays consistent.
export const CLAUDE_MODEL = "claude-opus-4-8";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: serverEnv.anthropicApiKey });
  }
  return cached;
}
