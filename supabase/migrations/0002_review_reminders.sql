-- Phase 2: story reviews, name replacements, and weekly reminders.

-- ---------------------------------------------------------------------------
-- story_reviews — one active review per story, findings + per-finding state
-- stored in jsonb (categories: missing_details, unclear, jargon, tone,
-- perspective, names).
-- ---------------------------------------------------------------------------
create table if not exists public.story_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null unique references public.stories(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  findings jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists story_reviews_user_idx on public.story_reviews(user_id);

alter table public.story_reviews enable row level security;
create policy "story_reviews_select_own" on public.story_reviews
  for select using (user_id = auth.uid());
create policy "story_reviews_insert_own" on public.story_reviews
  for insert with check (user_id = auth.uid());
create policy "story_reviews_update_own" on public.story_reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "story_reviews_delete_own" on public.story_reviews
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- stories.name_replacements — {"Original Name": "Replacement"} applied to
-- every future generate/append so changed/redacted names never resurface.
-- ---------------------------------------------------------------------------
alter table public.stories
  add column if not exists name_replacements jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- profiles — phone + weekly reminder preferences
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists phone text,
  add column if not exists reminder_opt_in boolean not null default false,
  add column if not exists reminder_channel text not null default 'sms'
    check (reminder_channel in ('sms','email'));
