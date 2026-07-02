import type { VoiceStyleProfile, VoiceStyleProfileData } from "@/lib/types";
import { glossaryPromptBlock } from "@/lib/stunt-glossary";

// ---------------------------------------------------------------------------
// The product's core IP: prompts that rewrite a raw transcript into polished
// prose IN THE SPEAKER'S VOICE, while NEVER inventing facts.
// ---------------------------------------------------------------------------

// Absolute rule reused across every generation prompt.
export const NO_FABRICATION_RULE = `CRITICAL — NO FABRICATION:
- Never add facts, names, dates, places, numbers, or events that are not present in the transcript(s).
- You may fix grammar, remove filler and false starts, and reorder for narrative flow.
- You may repair OBVIOUS speech-to-text errors of stunt-industry terms (see the glossary) when context makes the intended term clear — that is transcription repair, not new information.
- You may NOT invent details, embellish, or "fill in" what the speaker did not say.
- If the transcript is thin, produce a short chapter rather than padding it.
- Every concrete claim in your output must be traceable to the transcript. When in doubt, omit.`;

// Stunt vocabulary the transcriber frequently garbles; used for repair only.
export function glossarySection(): string {
  return `STUNT-TERM GLOSSARY (repair mis-transcriptions of these terms when context is clear; do not introduce terms the speaker didn't use):
${glossaryPromptBlock()}`;
}

/** Renders the "always call X → Y" rule for changed/redacted names. */
export function nameReplacementRule(
  nameReplacements: Record<string, string> | null | undefined,
): string {
  const entries = Object.entries(nameReplacements ?? {});
  if (!entries.length) return "";
  return `\nNAME REPLACEMENTS (the author changed or redacted these names — apply them EVERYWHERE, never output the original):
${entries.map(([from, to]) => `- "${from}" → "${to}"`).join("\n")}\n`;
}

// ---- Voice style profile ----

export const VOICE_PROFILE_SYSTEM = `You are a linguistic-style analyst. Given transcripts of a person speaking, describe HOW this person speaks — their rhythm, word choice, verbal tics, humor, and storytelling habits — NOT what they said. Capture only observable style features that would let a writer imitate their voice. Do not summarize content.`;

export function voiceProfileUserPrompt(transcripts: string[]): string {
  const joined = transcripts
    .map((t, i) => `--- Transcript ${i + 1} ---\n${t}`)
    .join("\n\n");
  return `Analyze the speaking style in the following transcripts and produce a structured style profile.\n\n${joined}`;
}

// JSON schema for the structured voice profile (used with structured outputs).
export const VOICE_PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    tone: { type: "string", description: "Overall emotional tone." },
    formality: { type: "string", description: "Formal, casual, salty, etc." },
    avg_sentence_length: {
      type: "string",
      description: "short / medium / long / varied",
    },
    cadence: { type: "string", description: "Rhythm and pacing of speech." },
    vocabulary_markers: {
      type: "array",
      items: { type: "string" },
      description: "Distinctive words or phrasings they favor.",
    },
    filler_words: { type: "array", items: { type: "string" } },
    catchphrases: { type: "array", items: { type: "string" } },
    humor: { type: "string", description: "Kind of humor, if any." },
    storytelling_habits: {
      type: "array",
      items: { type: "string" },
      description: "How they structure a story (e.g. starts with the punchline).",
    },
    do_not_do: {
      type: "array",
      items: { type: "string" },
      description: "Styles to avoid because they are unlike this speaker.",
    },
    summary: {
      type: "string",
      description: "One paragraph a ghostwriter could use as a voice guide.",
    },
  },
  required: [
    "tone",
    "formality",
    "avg_sentence_length",
    "cadence",
    "vocabulary_markers",
    "filler_words",
    "catchphrases",
    "humor",
    "storytelling_habits",
    "do_not_do",
    "summary",
  ],
} as const;

// ---- Chapter rewrite ----

export const CHAPTER_SYSTEM = `You are a ghostwriter who turns a person's spoken memories into polished book chapters written in the FIRST PERSON, in that exact person's voice. You imitate how they talk — their rhythm, vocabulary, and humor — so the reader hears them on the page.

Each chapter is a JOURNAL ENTRY: a diary-style story told from the speaker's own perspective. The story can be ABOUT someone else, but it is always the speaker telling it — what they saw, did, thought, and felt. Never drift into detached third-person narration or an outside observer's voice.

${NO_FABRICATION_RULE}

${glossarySection()}

OUTPUT:
- Return clean Markdown prose only. No preamble, no meta-commentary, no headings unless natural.
- Write in first person ("I", "we") as the speaker.
- Keep it a self-contained chapter of a memoir.`;

function renderVoiceGuide(voice: VoiceStyleProfile | null): string {
  if (!voice?.profile) {
    return "No voice profile is available yet. Infer the speaker's voice from the transcript itself and preserve it faithfully.";
  }
  const p: VoiceStyleProfileData = voice.profile;
  return `VOICE GUIDE (imitate this speaker):
- Tone: ${p.tone}
- Formality: ${p.formality}
- Sentence length: ${p.avg_sentence_length}
- Cadence: ${p.cadence}
- Favored vocabulary: ${p.vocabulary_markers.join(", ") || "n/a"}
- Filler words (use sparingly, keep it natural): ${p.filler_words.join(", ") || "n/a"}
- Catchphrases: ${p.catchphrases.join(", ") || "n/a"}
- Humor: ${p.humor}
- Storytelling habits: ${p.storytelling_habits.join("; ") || "n/a"}
- Do NOT: ${p.do_not_do.join("; ") || "n/a"}
${voice.summary ? `\nSummary: ${voice.summary}` : ""}`;
}

export function chapterGeneratePrompt(params: {
  promptText: string | null;
  transcripts: string[];
  voice: VoiceStyleProfile | null;
  guidance?: string;
  nameReplacements?: Record<string, string> | null;
}): string {
  const { promptText, transcripts, voice, guidance, nameReplacements } = params;
  const joined = transcripts
    .map((t, i) => `--- Recording ${i + 1} transcript ---\n${t}`)
    .join("\n\n");
  return `${renderVoiceGuide(voice)}
${nameReplacementRule(nameReplacements)}
${promptText ? `The speaker was answering this prompt: "${promptText}"\n` : ""}
Rewrite the following spoken transcript(s) into a first-person journal-style memoir chapter in the speaker's voice. Remember: ${NO_FABRICATION_RULE}
${guidance ? `\nEXTRA DIRECTION FROM THE AUTHOR: ${guidance}\n` : ""}
${joined}`;
}

export function chapterAppendPrompt(params: {
  existingChapter: string;
  newTranscripts: string[];
  voice: VoiceStyleProfile | null;
  nameReplacements?: Record<string, string> | null;
}): string {
  const { existingChapter, newTranscripts, voice, nameReplacements } = params;
  const joined = newTranscripts
    .map((t, i) => `--- New recording ${i + 1} transcript ---\n${t}`)
    .join("\n\n");
  return `${renderVoiceGuide(voice)}
${nameReplacementRule(nameReplacements)}
You are updating an existing chapter with additional material the speaker recorded later. Integrate the new material into the chapter.
- You MAY add information that appears in the new transcript(s).
- You MAY correct or update statements the speaker revises in the new material.
- You must still invent nothing beyond what the transcripts contain.
- Preserve the speaker's voice and the chapter's overall structure. Return the FULL updated chapter in Markdown.

${NO_FABRICATION_RULE}

--- EXISTING CHAPTER ---
${existingChapter}

${joined}`;
}
