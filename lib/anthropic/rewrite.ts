import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CLAUDE_MODEL } from "./client";
import {
  CHAPTER_SYSTEM,
  VOICE_PROFILE_SYSTEM,
  VOICE_PROFILE_SCHEMA,
  chapterGeneratePrompt,
  chapterAppendPrompt,
  voiceProfileUserPrompt,
} from "./prompts";
import type { VoiceStyleProfile, VoiceStyleProfileData } from "@/lib/types";

const MAX_TOKENS = 8000;

/** Extracts concatenated text from a Messages API response. */
function textFromMessage(message: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return message.content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

/** Derive a structured voice-style profile from a batch of transcripts. */
export async function generateVoiceProfile(
  transcripts: string[],
): Promise<{ profile: VoiceStyleProfileData; summary: string }> {
  const client = getAnthropic();
  const tool: Anthropic.Tool = {
    name: "record_voice_profile",
    description: "Record the speaker's linguistic style profile.",
    input_schema: VOICE_PROFILE_SCHEMA as unknown as Anthropic.Tool.InputSchema,
  };

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: VOICE_PROFILE_SYSTEM,
    tools: [tool],
    tool_choice: { type: "tool", name: "record_voice_profile" },
    messages: [{ role: "user", content: voiceProfileUserPrompt(transcripts) }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Voice profile generation did not return structured output.");
  }
  const input = toolUse.input as VoiceStyleProfileData & { summary: string };
  const { summary, ...profile } = input;
  return { profile: profile as VoiceStyleProfileData, summary };
}

/** Generate (or regenerate) a chapter from transcripts, in the speaker's voice. */
export async function generateChapter(params: {
  promptText: string | null;
  transcripts: string[];
  voice: VoiceStyleProfile | null;
  guidance?: string;
}): Promise<string> {
  const client = getAnthropic();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: CHAPTER_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: chapterGeneratePrompt(params) }],
  });
  return textFromMessage(message);
}

/** Merge new transcripts into an existing chapter without inventing facts. */
export async function appendToChapter(params: {
  existingChapter: string;
  newTranscripts: string[];
  voice: VoiceStyleProfile | null;
}): Promise<string> {
  const client = getAnthropic();
  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: "text", text: CHAPTER_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: chapterAppendPrompt(params) }],
  });
  return textFromMessage(message);
}
