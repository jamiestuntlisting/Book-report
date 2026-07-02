// Domain types mirroring the Postgres schema (supabase/migrations/0001_init.sql).
// Kept hand-written for clarity; regenerate with `supabase gen types` if desired.

export type StoryStatus =
  | "draft"
  | "recording"
  | "transcribing"
  | "generating"
  | "ready";

export type RecordingKind = "audio" | "video";
export type RecordingSource = "self_recorded" | "interview_zoom";
export type JobStatus = "queued" | "running" | "done" | "error";
export type ChapterStatus = "empty" | "generating" | "generated" | "edited";
export type ContentFormat = "markdown" | "tiptap_json";
export type ShareScope = "book" | "story";
export type InterviewStatus =
  | "requested"
  | "scheduled"
  | "completed"
  | "canceled";

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateQuestion {
  id: string;
  prompt: string;
  helper_text: string | null;
  sort_order: number;
  active: boolean;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  template_question_id: string | null;
  prompt_text: string | null;
  status: StoryStatus;
  chapter_number: number | null;
  sort_order: number;
  include_in_book: boolean;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  user_id: string;
  story_id: string;
  kind: RecordingKind;
  storage_bucket: string;
  storage_path: string;
  duration_seconds: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  source: RecordingSource;
  sort_order: number;
  created_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  id: string;
  user_id: string;
  recording_id: string;
  provider: string | null;
  language: string | null;
  text: string | null;
  segments: TranscriptSegment[] | null;
  status: JobStatus;
  error: string | null;
  created_at: string;
}

export interface VoiceStyleProfileData {
  tone: string;
  formality: string;
  avg_sentence_length: string;
  cadence: string;
  vocabulary_markers: string[];
  filler_words: string[];
  catchphrases: string[];
  humor: string;
  storytelling_habits: string[];
  do_not_do: string[];
}

export interface VoiceStyleProfile {
  id: string;
  user_id: string;
  is_active: boolean;
  version: number;
  profile: VoiceStyleProfileData | null;
  summary: string | null;
  source_transcript_ids: string[];
  created_at: string;
}

export interface ChapterGenerationMeta {
  voice_profile_version?: number;
  transcript_ids?: string[];
  prompt_hash?: string;
  guidance?: string;
  history?: Array<{ text: string; at: string; reason: string }>;
}

export interface Chapter {
  id: string;
  user_id: string;
  story_id: string;
  title: string | null;
  number: number | null;
  generated_text: string | null;
  edited_text: string | null;
  content_format: ContentFormat;
  model: string | null;
  generation_meta: ChapterGenerationMeta | null;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  chapter_id: string;
  storage_bucket: string;
  storage_path: string;
  caption: string | null;
  position: number;
  layout: string | null;
  created_at: string;
}

export interface ChapterLink {
  id: string;
  user_id: string;
  chapter_id: string;
  url: string;
  label: string | null;
  position: number;
  created_at: string;
}

export interface BookSettings {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  cover_image_path: string | null;
  dedication: string | null;
  foreword: string | null;
  trim_size: string;
  font_family: string;
  theme: string;
  chapter_order: string[] | null;
  updated_at: string;
}

export interface Share {
  id: string;
  user_id: string;
  token: string;
  scope: ShareScope;
  story_id: string | null;
  expires_at: string | null;
  revoked: boolean;
  view_count: number;
  created_at: string;
}

export interface InterviewAppointment {
  id: string;
  user_id: string;
  scheduled_at: string | null;
  timezone: string | null;
  status: InterviewStatus;
  provider: string;
  provider_meeting_id: string | null;
  join_url: string | null;
  scheduling_ref: string | null;
  recording_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string | null;
  kind: string;
  ref_table: string | null;
  ref_id: string | null;
  status: JobStatus;
  error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
