import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic/client";
import { glossaryPromptBlock } from "@/lib/stunt-glossary";
import { searchPerson } from "@/lib/people/tmdb";
import type { ReviewFindings } from "@/lib/types";

// The story-review engine: reads a chapter (plus its raw transcripts for
// context) and surfaces what an editor would flag — missing story points,
// confusing passages, garbled stunt jargon, unintentionally negative tone,
// perspective drift, and the people named (for verification/redaction).

const REVIEW_SYSTEM = `You are a sharp, kind memoir editor reviewing one chapter of a stunt performer's journal-style memoir. Your job is to flag issues for the AUTHOR to act on — you do not rewrite the chapter yourself.

Review for exactly these things:
1. MISSING DETAILS — story points a reader will wonder about: which movie/show was this on? who was there? when/where did it happen? what was the outcome? Only ask questions the chapter genuinely leaves open, and only where the answer would strengthen THIS story.
2. UNCLEAR — passages that don't quite make sense, contradict themselves, assume context the reader doesn't have, or need a little more explanation.
3. JARGON — stunt-industry terms that look mis-transcribed by speech-to-text. Use the glossary below; also flag phrases that read like a garbled version of a plausible stunt term even if it's not in the glossary. Quote text EXACTLY as it appears.
4. TONE — passages that read as harsh, bitter, or insulting toward a person or production in a way the speaker probably doesn't intend for a published book. Suggest a softer rewrite that keeps the meaning and the speaker's voice. Do NOT flag honest descriptions of fear, pain, or difficulty — that's the good stuff.
5. PERSPECTIVE — this must read as a first-person journal entry. Flag passages that drift into detached third-person narration or an outside observer's voice.
6. NAMES — list EVERY person named in the chapter (full or partial names), with a one-line description of their role in the story. Do not include the author themself.

RULES:
- Quotes must be copied EXACTLY, character-for-character, from the chapter text (they are used for find-and-replace).
- Be selective: flag what matters, not everything. An empty category is a fine answer.
- Never invent facts in suggestions; suggestions may only rephrase what is already there.

STUNT-TERM GLOSSARY:
${glossaryPromptBlock()}`;

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    missing_details: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          why: { type: "string", description: "Why this would strengthen the story." },
        },
        required: ["question", "why"],
      },
    },
    unclear: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          quote: { type: "string", description: "Exact text from the chapter." },
          issue: { type: "string" },
          suggestion: { type: "string", description: "What to record/clarify." },
        },
        required: ["quote", "issue", "suggestion"],
      },
    },
    jargon: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          found: { type: "string", description: "Exact garbled text from the chapter." },
          suggested: { type: "string", description: "The intended stunt term." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["found", "suggested", "confidence"],
      },
    },
    tone: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          quote: { type: "string", description: "Exact text from the chapter." },
          why: { type: "string", description: "Why it reads negative." },
          rewrite: { type: "string", description: "Softer version, same meaning and voice." },
        },
        required: ["quote", "why", "rewrite"],
      },
    },
    perspective: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          quote: { type: "string", description: "Exact text from the chapter." },
          fix: { type: "string", description: "First-person rephrasing." },
        },
        required: ["quote", "fix"],
      },
    },
    names: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Name exactly as written in the chapter." },
          context: { type: "string", description: "Their role in this story." },
        },
        required: ["name", "context"],
      },
    },
  },
  required: ["missing_details", "unclear", "jargon", "tone", "perspective", "names"],
} as const;

interface RawReview {
  missing_details: Array<{ question: string; why: string }>;
  unclear: Array<{ quote: string; issue: string; suggestion: string }>;
  jargon: Array<{ found: string; suggested: string; confidence: "high" | "medium" | "low" }>;
  tone: Array<{ quote: string; why: string; rewrite: string }>;
  perspective: Array<{ quote: string; fix: string }>;
  names: Array<{ name: string; context: string }>;
}

/** Runs the editorial review and enriches names with TMDB candidates. */
export async function reviewChapter(params: {
  chapterText: string;
  promptText: string | null;
  transcripts: string[];
}): Promise<ReviewFindings> {
  const client = getAnthropic();
  const tool: Anthropic.Tool = {
    name: "report_review",
    description: "Report the editorial review findings.",
    input_schema: REVIEW_SCHEMA as unknown as Anthropic.Tool.InputSchema,
  };

  const transcriptBlock = params.transcripts.length
    ? `\n\nFor context, the raw spoken transcript(s) the chapter came from (use these to judge what the speaker actually said, e.g. for jargon repair):\n${params.transcripts
        .map((t, i) => `--- Transcript ${i + 1} ---\n${t}`)
        .join("\n\n")}`
    : "";

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: REVIEW_SYSTEM,
    tools: [tool],
    tool_choice: { type: "tool", name: "report_review" },
    messages: [
      {
        role: "user",
        content: `${params.promptText ? `The chapter answers the prompt: "${params.promptText}"\n\n` : ""}--- CHAPTER ---\n${params.chapterText}${transcriptBlock}`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Review did not return structured output.");
  }
  const raw = toolUse.input as RawReview;

  // Enrich each detected name with TMDB candidates (spelling + identity).
  const names = await Promise.all(
    raw.names.map(async (n, i) => ({
      id: `name-${i}`,
      status: "open" as const,
      name: n.name,
      context: n.context,
      candidates: await searchPerson(n.name),
    })),
  );

  return {
    missing_details: raw.missing_details.map((f, i) => ({
      id: `missing-${i}`,
      status: "open" as const,
      ...f,
    })),
    unclear: raw.unclear.map((f, i) => ({
      id: `unclear-${i}`,
      status: "open" as const,
      ...f,
    })),
    jargon: raw.jargon.map((f, i) => ({
      id: `jargon-${i}`,
      status: "open" as const,
      ...f,
    })),
    tone: raw.tone.map((f, i) => ({
      id: `tone-${i}`,
      status: "open" as const,
      ...f,
    })),
    perspective: raw.perspective.map((f, i) => ({
      id: `perspective-${i}`,
      status: "open" as const,
      ...f,
    })),
    names,
  };
}
