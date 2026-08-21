-- Stuntman Stories — D1 (SQLite) schema. Twin of lib/db/schema.ts.
-- Apply remotely with the Cloudflare API/dashboard, or locally with:
--   npx wrangler d1 execute stuntman-stories --local --file=db/schema.sql

-- Auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users(phone);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_tokens (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('magic','sms')),
  identifier TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS login_tokens_identifier_idx ON login_tokens(identifier);

-- App
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  reminder_opt_in INTEGER NOT NULL DEFAULT 0,
  reminder_channel TEXT NOT NULL DEFAULT 'sms' CHECK (reminder_channel IN ('sms','email')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_questions (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  helper_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled story',
  template_question_id TEXT,
  prompt_text TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','recording','transcribing','generating','ready')),
  chapter_number INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  include_in_book INTEGER NOT NULL DEFAULT 1,
  name_replacements TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS stories_user_idx ON stories(user_id, sort_order);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('audio','video')),
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_seconds REAL,
  mime_type TEXT,
  size_bytes INTEGER,
  source TEXT NOT NULL DEFAULT 'self_recorded'
    CHECK (source IN ('self_recorded','interview_zoom')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recordings_story_idx ON recordings(story_id, sort_order);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  provider TEXT,
  language TEXT,
  text TEXT,
  segments TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','error')),
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transcripts_recording_idx ON transcripts(recording_id);

CREATE TABLE IF NOT EXISTS voice_style_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1,
  profile TEXT,
  summary TEXT,
  source_transcript_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_profiles_user_idx ON voice_style_profiles(user_id, is_active);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  title TEXT,
  number INTEGER,
  generated_text TEXT,
  edited_text TEXT,
  content_format TEXT NOT NULL DEFAULT 'markdown'
    CHECK (content_format IN ('markdown','tiptap_json')),
  model TEXT,
  generation_meta TEXT,
  status TEXT NOT NULL DEFAULT 'empty'
    CHECK (status IN ('empty','generating','generated','edited')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chapters_story_idx ON chapters(story_id);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  layout TEXT DEFAULT 'full',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_chapter_idx ON photos(chapter_id, position);

CREATE TABLE IF NOT EXISTS chapter_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chapter_links_chapter_idx ON chapter_links(chapter_id, position);

CREATE TABLE IF NOT EXISTS book_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'My Stunt Stories',
  subtitle TEXT,
  author_name TEXT,
  cover_image_path TEXT,
  dedication TEXT,
  foreword TEXT,
  trim_size TEXT NOT NULL DEFAULT '6x9',
  font_family TEXT NOT NULL DEFAULT 'serif',
  theme TEXT NOT NULL DEFAULT 'classic',
  chapter_order TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'book' CHECK (scope IN ('book','story')),
  story_id TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shares_token_idx ON shares(token);

CREATE TABLE IF NOT EXISTS interview_appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','scheduled','completed','canceled')),
  provider TEXT NOT NULL DEFAULT 'zoom',
  provider_meeting_id TEXT,
  join_url TEXT,
  scheduling_ref TEXT,
  recording_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS interviews_user_idx ON interview_appointments(user_id);
CREATE INDEX IF NOT EXISTS interviews_meeting_idx ON interview_appointments(provider_meeting_id);

CREATE TABLE IF NOT EXISTS story_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL UNIQUE REFERENCES stories(id) ON DELETE CASCADE,
  chapter_id TEXT,
  findings TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_reviews_user_idx ON story_reviews(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  kind TEXT NOT NULL,
  ref_table TEXT,
  ref_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','error')),
  error TEXT,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_ref_idx ON jobs(ref_table, ref_id);

-- Seed: the eight starter questions (idempotent by fixed ids).
INSERT OR IGNORE INTO template_questions (id, prompt, helper_text, sort_order, active) VALUES
  ('q-origin',   'How did you get into stunts?', 'Your origin story — the first job, the first fall, who gave you a shot.', 10, 1),
  ('q-why',      'Why do you like stunts?', 'What keeps you coming back to the work.', 20, 1),
  ('q-biggest',  'What is the biggest stunt you have ever done?', 'The one people ask about. Set the scene.', 30, 1),
  ('q-favorite', 'What is your favorite stunt you have done?', 'Not the biggest — the one you loved.', 40, 1),
  ('q-mentor',   'Who has been a mentor for you?', 'Someone who taught you, protected you, or set the bar.', 50, 1),
  ('q-recent',   'Tell us about a recent day on set and the thoughts you had.', 'A normal day, in detail — what was going through your head.', 60, 1),
  ('q-proud',    'What is a stunt you are really proud of?', 'Something that took everything you had.', 70, 1),
  ('q-else',     'What would you be doing if you did not do stunts?', 'The road not taken.', 80, 1);
