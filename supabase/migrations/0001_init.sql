-- Stuntman Stories — initial schema, RLS, storage, and seed data.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;

  insert into public.book_settings (user_id, title)
  values (new.id, 'My Stunt Stories')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- template_questions (global, read-only to clients)
-- ---------------------------------------------------------------------------
create table if not exists public.template_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  helper_text text,
  sort_order int not null default 0,
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- stories
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled story',
  template_question_id uuid references public.template_questions(id) on delete set null,
  prompt_text text,
  status text not null default 'draft'
    check (status in ('draft','recording','transcribing','generating','ready')),
  chapter_number int,
  sort_order int not null default 0,
  include_in_book boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stories_user_idx on public.stories(user_id, sort_order);

create trigger stories_updated_at
  before update on public.stories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recordings
-- ---------------------------------------------------------------------------
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  kind text not null check (kind in ('audio','video')),
  storage_bucket text not null,
  storage_path text not null,
  duration_seconds numeric,
  mime_type text,
  size_bytes bigint,
  source text not null default 'self_recorded'
    check (source in ('self_recorded','interview_zoom')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recordings_story_idx on public.recordings(story_id, sort_order);

-- ---------------------------------------------------------------------------
-- transcripts
-- ---------------------------------------------------------------------------
create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recording_id uuid not null references public.recordings(id) on delete cascade,
  provider text,
  language text,
  text text,
  segments jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','done','error')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists transcripts_recording_idx on public.transcripts(recording_id);

-- ---------------------------------------------------------------------------
-- voice_style_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.voice_style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  version int not null default 1,
  profile jsonb,
  summary text,
  source_transcript_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists voice_profiles_user_idx on public.voice_style_profiles(user_id, is_active);

-- ---------------------------------------------------------------------------
-- chapters
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  title text,
  number int,
  generated_text text,
  edited_text text,
  content_format text not null default 'markdown'
    check (content_format in ('markdown','tiptap_json')),
  model text,
  generation_meta jsonb,
  status text not null default 'empty'
    check (status in ('empty','generating','generated','edited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chapters_story_idx on public.chapters(story_id);

create trigger chapters_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  caption text,
  position int not null default 0,
  layout text default 'full',
  created_at timestamptz not null default now()
);
create index if not exists photos_chapter_idx on public.photos(chapter_id, position);

-- ---------------------------------------------------------------------------
-- chapter_links (rendered as QR codes in the book)
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  url text not null,
  label text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists chapter_links_chapter_idx on public.chapter_links(chapter_id, position);

-- ---------------------------------------------------------------------------
-- book_settings (one per user)
-- ---------------------------------------------------------------------------
create table if not exists public.book_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  title text not null default 'My Stunt Stories',
  subtitle text,
  author_name text,
  cover_image_path text,
  dedication text,
  foreword text,
  trim_size text not null default '6x9',
  font_family text not null default 'serif',
  theme text not null default 'classic',
  chapter_order uuid[],
  updated_at timestamptz not null default now()
);

create trigger book_settings_updated_at
  before update on public.book_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shares
-- ---------------------------------------------------------------------------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  scope text not null default 'book' check (scope in ('book','story')),
  story_id uuid references public.stories(id) on delete cascade,
  expires_at timestamptz,
  revoked boolean not null default false,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shares_token_idx on public.shares(token);

-- ---------------------------------------------------------------------------
-- interview_appointments
-- ---------------------------------------------------------------------------
create table if not exists public.interview_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz,
  timezone text,
  status text not null default 'requested'
    check (status in ('requested','scheduled','completed','canceled')),
  provider text not null default 'zoom',
  provider_meeting_id text,
  join_url text,
  scheduling_ref text,
  recording_id uuid references public.recordings(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists interviews_user_idx on public.interview_appointments(user_id);
create index if not exists interviews_meeting_idx on public.interview_appointments(provider_meeting_id);

-- ---------------------------------------------------------------------------
-- jobs (generic async tracker)
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  ref_table text,
  ref_id uuid,
  status text not null default 'queued'
    check (status in ('queued','running','done','error')),
  error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_ref_idx on public.jobs(ref_table, ref_id);

create trigger jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.template_questions enable row level security;
alter table public.stories enable row level security;
alter table public.recordings enable row level security;
alter table public.transcripts enable row level security;
alter table public.voice_style_profiles enable row level security;
alter table public.chapters enable row level security;
alter table public.photos enable row level security;
alter table public.chapter_links enable row level security;
alter table public.book_settings enable row level security;
alter table public.shares enable row level security;
alter table public.interview_appointments enable row level security;
alter table public.jobs enable row level security;

-- profiles: own row only
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- template_questions: readable by anyone signed in; no client writes
create policy "template_questions_read" on public.template_questions
  for select using (active = true);

-- Owner-scoped tables: full CRUD when user_id = auth.uid()
do $$
declare t text;
begin
  foreach t in array array[
    'stories','recordings','transcripts','voice_style_profiles',
    'chapters','photos','chapter_links','book_settings',
    'shares','interview_appointments','jobs'
  ]
  loop
    execute format('create policy %I on public.%I for select using (user_id = auth.uid());', t||'_select_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid());', t||'_insert_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());', t||'_update_own', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid());', t||'_delete_own', t);
  end loop;
end;
$$;

-- ===========================================================================
-- Storage buckets + policies
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('audio','audio', false), ('video','video', false),
       ('photos','photos', false), ('exports','exports', false)
on conflict (id) do nothing;

-- Ownership is encoded in the first path segment: {user_id}/...
-- Each policy checks (storage.foldername(name))[1] = auth.uid().
do $$
declare b text;
begin
  foreach b in array array['audio','video','photos','exports']
  loop
    execute format($f$
      create policy %I on storage.objects for select
        using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b||'_read_own', b);
    execute format($f$
      create policy %I on storage.objects for insert
        with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b||'_insert_own', b);
    execute format($f$
      create policy %I on storage.objects for update
        using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b||'_update_own', b);
    execute format($f$
      create policy %I on storage.objects for delete
        using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);
    $f$, b||'_delete_own', b);
  end loop;
end;
$$;

-- ===========================================================================
-- Seed: template starter questions
-- ===========================================================================
insert into public.template_questions (prompt, helper_text, sort_order) values
  ('How did you get into stunts?', 'Your origin story — the first job, the first fall, who gave you a shot.', 10),
  ('Why do you like stunts?', 'What keeps you coming back to the work.', 20),
  ('What is the biggest stunt you have ever done?', 'The one people ask about. Set the scene.', 30),
  ('What is your favorite stunt you have done?', 'Not the biggest — the one you loved.', 40),
  ('Who has been a mentor for you?', 'Someone who taught you, protected you, or set the bar.', 50),
  ('Tell us about a recent day on set and the thoughts you had.', 'A normal day, in detail — what was going through your head.', 60),
  ('What is a stunt you are really proud of?', 'Something that took everything you had.', 70),
  ('What would you be doing if you did not do stunts?', 'The road not taken.', 80)
on conflict do nothing;
