// Drizzle schema for Cloudflare D1 (SQLite). Mirrors the shapes in
// lib/types.ts: snake_case columns, ISO-8601 text timestamps, JSON-in-text for
// structured fields. The raw DDL twin lives in db/schema.sql.
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type {
  ChapterGenerationMeta,
  ReviewFindings,
  TranscriptSegment,
  VoiceStyleProfileData,
} from "@/lib/types";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const nowIso = () => new Date().toISOString();
const createdAt = () => text("created_at").notNull().$defaultFn(nowIso);
const updatedAt = () => text("updated_at").notNull().$defaultFn(nowIso);

// ---- Auth (replaces Supabase Auth) ----

export const users = sqliteTable(
  "users",
  {
    id: id(),
    email: text("email"),
    phone: text("phone"),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_phone_idx").on(t.phone),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires_at: text("expires_at").notNull(),
    created_at: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.user_id)],
);

// One-time login credentials: magic-link tokens and SMS codes. Only a SHA-256
// hash of the secret is stored.
export const login_tokens = sqliteTable(
  "login_tokens",
  {
    id: id(),
    type: text("type", { enum: ["magic", "sms"] }).notNull(),
    identifier: text("identifier").notNull(), // email or phone
    token_hash: text("token_hash").notNull(),
    expires_at: text("expires_at").notNull(),
    consumed: integer("consumed", { mode: "boolean" }).notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("login_tokens_identifier_idx").on(t.identifier)],
);

// ---- App tables (ported from supabase/migrations) ----

export const profiles = sqliteTable("profiles", {
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  display_name: text("display_name"),
  email: text("email"),
  avatar_url: text("avatar_url"),
  bio: text("bio"),
  phone: text("phone"),
  reminder_opt_in: integer("reminder_opt_in", { mode: "boolean" })
    .notNull()
    .default(false),
  reminder_channel: text("reminder_channel", { enum: ["sms", "email"] })
    .notNull()
    .default("sms"),
  created_at: createdAt(),
  updated_at: updatedAt(),
});

export const template_questions = sqliteTable("template_questions", {
  id: id(),
  prompt: text("prompt").notNull(),
  helper_text: text("helper_text"),
  sort_order: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const stories = sqliteTable(
  "stories",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled story"),
    template_question_id: text("template_question_id"),
    prompt_text: text("prompt_text"),
    status: text("status", {
      enum: ["draft", "recording", "transcribing", "generating", "ready"],
    })
      .notNull()
      .default("draft"),
    chapter_number: integer("chapter_number"),
    sort_order: integer("sort_order").notNull().default(0),
    include_in_book: integer("include_in_book", { mode: "boolean" })
      .notNull()
      .default(true),
    name_replacements: text("name_replacements", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("stories_user_idx").on(t.user_id, t.sort_order)],
);

export const recordings = sqliteTable(
  "recordings",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    story_id: text("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["audio", "video"] }).notNull(),
    storage_bucket: text("storage_bucket").notNull(),
    storage_path: text("storage_path").notNull(),
    duration_seconds: real("duration_seconds"),
    mime_type: text("mime_type"),
    size_bytes: integer("size_bytes"),
    source: text("source", { enum: ["self_recorded", "interview_zoom"] })
      .notNull()
      .default("self_recorded"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("recordings_story_idx").on(t.story_id, t.sort_order)],
);

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recording_id: text("recording_id")
      .notNull()
      .references(() => recordings.id, { onDelete: "cascade" }),
    provider: text("provider"),
    language: text("language"),
    text: text("text"),
    segments: text("segments", { mode: "json" }).$type<
      TranscriptSegment[] | null
    >(),
    status: text("status", { enum: ["queued", "running", "done", "error"] })
      .notNull()
      .default("queued"),
    error: text("error"),
    created_at: createdAt(),
  },
  (t) => [index("transcripts_recording_idx").on(t.recording_id)],
);

export const voice_style_profiles = sqliteTable(
  "voice_style_profiles",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    is_active: integer("is_active", { mode: "boolean" }).notNull().default(true),
    version: integer("version").notNull().default(1),
    profile: text("profile", { mode: "json" }).$type<VoiceStyleProfileData | null>(),
    summary: text("summary"),
    source_transcript_ids: text("source_transcript_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    created_at: createdAt(),
  },
  (t) => [index("voice_profiles_user_idx").on(t.user_id, t.is_active)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    story_id: text("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    title: text("title"),
    number: integer("number"),
    generated_text: text("generated_text"),
    edited_text: text("edited_text"),
    content_format: text("content_format", { enum: ["markdown", "tiptap_json"] })
      .notNull()
      .default("markdown"),
    model: text("model"),
    generation_meta: text("generation_meta", { mode: "json" }).$type<
      ChapterGenerationMeta | null
    >(),
    status: text("status", {
      enum: ["empty", "generating", "generated", "edited"],
    })
      .notNull()
      .default("empty"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("chapters_story_idx").on(t.story_id)],
);

export const photos = sqliteTable(
  "photos",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapter_id: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    storage_bucket: text("storage_bucket").notNull(),
    storage_path: text("storage_path").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    layout: text("layout").default("full"),
    created_at: createdAt(),
  },
  (t) => [index("photos_chapter_idx").on(t.chapter_id, t.position)],
);

export const chapter_links = sqliteTable(
  "chapter_links",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapter_id: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    position: integer("position").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("chapter_links_chapter_idx").on(t.chapter_id, t.position)],
);

export const book_settings = sqliteTable("book_settings", {
  id: id(),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("My Stunt Stories"),
  subtitle: text("subtitle"),
  author_name: text("author_name"),
  cover_image_path: text("cover_image_path"),
  dedication: text("dedication"),
  foreword: text("foreword"),
  trim_size: text("trim_size").notNull().default("6x9"),
  font_family: text("font_family").notNull().default("serif"),
  theme: text("theme").notNull().default("classic"),
  chapter_order: text("chapter_order", { mode: "json" }).$type<string[] | null>(),
  updated_at: updatedAt(),
});

export const shares = sqliteTable(
  "shares",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    scope: text("scope", { enum: ["book", "story"] }).notNull().default("book"),
    story_id: text("story_id"),
    expires_at: text("expires_at"),
    revoked: integer("revoked", { mode: "boolean" }).notNull().default(false),
    view_count: integer("view_count").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [index("shares_token_idx").on(t.token)],
);

export const interview_appointments = sqliteTable(
  "interview_appointments",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduled_at: text("scheduled_at"),
    timezone: text("timezone"),
    status: text("status", {
      enum: ["requested", "scheduled", "completed", "canceled"],
    })
      .notNull()
      .default("requested"),
    provider: text("provider").notNull().default("zoom"),
    provider_meeting_id: text("provider_meeting_id"),
    join_url: text("join_url"),
    scheduling_ref: text("scheduling_ref"),
    recording_id: text("recording_id"),
    notes: text("notes"),
    created_at: createdAt(),
  },
  (t) => [
    index("interviews_user_idx").on(t.user_id),
    index("interviews_meeting_idx").on(t.provider_meeting_id),
  ],
);

export const story_reviews = sqliteTable(
  "story_reviews",
  {
    id: id(),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    story_id: text("story_id")
      .notNull()
      .unique()
      .references(() => stories.id, { onDelete: "cascade" }),
    chapter_id: text("chapter_id"),
    findings: text("findings", { mode: "json" })
      .$type<ReviewFindings>()
      .notNull(),
    model: text("model"),
    created_at: createdAt(),
  },
  (t) => [index("story_reviews_user_idx").on(t.user_id)],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: id(),
    user_id: text("user_id"),
    kind: text("kind").notNull(),
    ref_table: text("ref_table"),
    ref_id: text("ref_id"),
    status: text("status", { enum: ["queued", "running", "done", "error"] })
      .notNull()
      .default("queued"),
    error: text("error"),
    result: text("result", { mode: "json" }).$type<Record<
      string,
      unknown
    > | null>(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("jobs_ref_idx").on(t.ref_table, t.ref_id)],
);
