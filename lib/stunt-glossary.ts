// Domain vocabulary for stunt work. Speech-to-text models garble these terms
// because they're rare in general speech ("jerk vest" → "jerk best" / "drug
// vest"). Used to (1) bias Whisper's decoding, (2) let the chapter writer
// repair obvious mis-transcriptions, and (3) drive the story-review jargon check.

export interface GlossaryTerm {
  term: string;
  /** Common ways ASR mis-hears it. */
  mishearings: string[];
  /** One-line meaning, for the reviewer prompt. */
  meaning: string;
}

export const STUNT_GLOSSARY: GlossaryTerm[] = [
  { term: "jerk vest", mishearings: ["jerk best", "drug vest", "jerk fest", "work vest"], meaning: "harness vest used to yank a performer backwards (wire pull)" },
  { term: "jerk harness", mishearings: ["jerk on us", "jerk in us"], meaning: "full-body harness for pull-back gags" },
  { term: "stunt rigging", mishearings: ["stunt ridging", "stunt wringing", "some rigging"], meaning: "the wire/cable systems that fly or catch performers" },
  { term: "ratchet", mishearings: ["rachet", "ratch it", "rat shit"], meaning: "pneumatic device that yanks a performer through the air" },
  { term: "air ram", mishearings: ["a ram", "air ramp", "aero ram"], meaning: "pneumatic launcher that throws a performer" },
  { term: "decel rig", mishearings: ["dessel rig", "diesel rig", "de cell rig"], meaning: "deceleration system for high falls" },
  { term: "high fall", mishearings: ["high ball", "hi fall"], meaning: "a fall from height onto a catcher system" },
  { term: "squib", mishearings: ["squid", "squab"], meaning: "small pyrotechnic charge simulating a bullet hit" },
  { term: "airbag", mishearings: ["air bag", "airbagged"], meaning: "inflatable catcher for falls" },
  { term: "catcher bag", mishearings: ["catch a bag"], meaning: "padded bag that catches a falling performer" },
  { term: "pick points", mishearings: ["pig points", "pick joints"], meaning: "anchor points a performer is wired from" },
  { term: "Russian swing", mishearings: ["russian string", "rushing swing"], meaning: "large swing used to launch performers" },
  { term: "wire work", mishearings: ["wire word", "why our work"], meaning: "wire-assisted stunt performance" },
  { term: "gag", mishearings: ["gig", "bag"], meaning: "industry slang for a stunt" },
  { term: "full burn", mishearings: ["fullborn", "full bird"], meaning: "fire stunt where the performer is fully alight" },
  { term: "fire burn", mishearings: ["fire barn"], meaning: "fire stunt" },
  { term: "car hit", mishearings: ["carhit", "car hat"], meaning: "stunt where a performer is struck by a vehicle" },
  { term: "pipe ramp", mishearings: ["pie ramp", "piper amp"], meaning: "ramp that flips a moving car" },
  { term: "cannon roll", mishearings: ["cannonball", "canon roll"], meaning: "device that flips a car into a roll" },
  { term: "stunt coordinator", mishearings: ["stunt coordinater", "stuck coordinator"], meaning: "head of the stunt department" },
  { term: "second unit", mishearings: ["second you knit", "secondunit"], meaning: "crew that shoots action/stunt sequences" },
  { term: "nondescript (ND)", mishearings: ["andy", "an ND", "indy"], meaning: "ND: generic/unbranded (car, wardrobe) or background double work" },
  { term: "stunt double", mishearings: ["stunt trouble", "stun double"], meaning: "performer doubling an actor" },
  { term: "utility stunts", mishearings: ["utility stunt s", "futility stunts"], meaning: "general stunt performer role on a crew" },
  { term: "body burn", mishearings: ["buddy burn"], meaning: "partial fire stunt" },
  { term: "stair fall", mishearings: ["stare fall", "star fall"], meaning: "falling down stairs gag" },
  { term: "breakaway", mishearings: ["break away glass", "brake away"], meaning: "props/glass built to shatter safely" },
  { term: "crash pad", mishearings: ["crash pat"], meaning: "foam pad that catches falls" },
  { term: "face replacement", mishearings: ["faceplacement"], meaning: "VFX putting the actor's face on the double" },
];

/** Comma-separated term list — used to bias Whisper via its `prompt` param. */
export function glossaryWhisperPrompt(): string {
  const terms = STUNT_GLOSSARY.map((g) => g.term).join(", ");
  return `A stunt performer describes film-set work. Vocabulary: ${terms}.`;
}

/** Compact glossary block for Claude prompts (generation + review). */
export function glossaryPromptBlock(): string {
  return STUNT_GLOSSARY.map(
    (g) =>
      `- "${g.term}" (${g.meaning}); often mis-transcribed as: ${g.mishearings.join(", ")}`,
  ).join("\n");
}
