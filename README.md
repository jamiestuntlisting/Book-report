# Stuntman Stories

_Working title: **The Death of the Stuntman**_

A StoryCorps-style app where professional stunt people record firsthand stories
from their careers — just by talking. Each memo is transcribed and rewritten by
Claude into a polished chapter **in the speaker's own voice** (it imitates how
they talk and never invents facts). Chapters are organized, enriched with photos
and scannable QR links, and compiled into a print-ready book you can sell.

## What it does

- **Magic-link auth** (Supabase) — unique login per storyteller.
- **Template starter questions** to get people talking ("How did you get into
  stunts?", "The biggest stunt you've ever done?", …).
- **Record audio or video** in the browser (or upload a file). Media is stored
  in Supabase Storage (S3-backed).
- **Automatic transcription** (OpenAI Whisper by default, behind a swappable
  `Transcriber` interface).
- **Voice-preserving AI rewrite** — Claude derives a *voice-style profile* from
  your transcripts and writes each chapter in that voice, adding no new facts.
- **Regenerate** a chapter (with optional direction) or **merge in new memos**
  to add/correct details later.
- **Edit** chapter text (Markdown) and rename chapters.
- **Organize** stories on a drag-to-reorder dashboard; assign chapter numbers
  and toggle what's included in the book.
- **Photos** and **QR-code links** inside chapters.
- **Print-ready PDF export** (KDP-style trim sizes) via headless Chromium.
- **Share** a public, read-only book via link.
- **Interviews** — request a time to be interviewed; a Zoom webhook ingests the
  recording and feeds it into the same pipeline.
- **Story check** — an editor's review of any chapter: missing story points
  (which movie? who was there?), unclear passages, mis-transcribed stunt jargon
  ("jerk vest", "stunt rigging"), tone warnings for unintentionally negative
  passages, and journal-voice (first-person) drift — each with one-click fixes.
- **Name verification & redaction** — people named in a story are checked
  against TMDB (with IMDb links) for spelling/identity; correct the spelling,
  change a name, or redact to initials. Changes persist through regenerations.
- **Text-message login** — get a one-time code by SMS (Supabase phone auth via
  Twilio), alongside email magic links.
- **Weekly reminders** — opted-in storytellers get a weekly text (or email)
  with a story prompt and a one-tap sign-in link.

## Tech stack

Next.js (App Router, TypeScript) · Supabase (Auth + Postgres + Storage) ·
Claude (`@anthropic-ai/sdk`) · OpenAI Whisper (transcription) · Puppeteer
(PDF) · Tailwind CSS. Deploys to Vercel.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged client. **Never expose.** |
| `ANTHROPIC_API_KEY` | Claude — chapter rewriting + voice profile |
| `OPENAI_API_KEY` | Whisper transcription |
| `NEXT_PUBLIC_APP_URL` | Base URL (magic-link + share links) |
| `PDF_RENDER_TOKEN` | Shared secret gating the private print page |
| `TMDB_API_KEY` | Name verification in story review (free key at themoviedb.org) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Weekly reminder texts |
| `CRON_SECRET` | Guards `/api/cron/reminders` (Vercel Cron sends it automatically) |
| `ZOOM_*`, `CALCOM_API_KEY`, `CALENDLY_TOKEN` | Optional interview integrations |

### 3. Set up the database

Apply the migration to your Supabase project — it creates every table, RLS
policy, storage bucket, the `profiles` trigger, and seeds the starter questions:

```bash
# With the Supabase CLI:
supabase db push
# ...or paste supabase/migrations/0001_init.sql into the Supabase SQL editor.
```

Enable the **Email** auth provider in Supabase (magic link) and add
`${NEXT_PUBLIC_APP_URL}/auth/callback` to the allowed redirect URLs.

**For text-message login** (optional): in the Supabase dashboard go to
*Authentication → Providers → Phone*, enable it, and plug in your Twilio
Account SID, Auth Token, and Message Service/From number. The login page's
"Text me" tab works immediately after; until then it shows a friendly
"not set up yet" message and email login keeps working.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## End-to-end flow

1. Sign in with a magic link.
2. New story → pick a prompt.
3. Record an audio/video memo → it uploads and transcribes automatically.
4. **Generate chapter** → Claude writes it in your voice.
5. Edit / regenerate / merge in another memo.
6. Add photos and QR links.
7. Run **Story check** — answer its questions with a new memo, apply jargon and
   tone fixes, verify or redact names.
8. Reorder stories on the dashboard and number them as chapters.
9. On **Book**: set the title/front matter, **Export PDF**, or **Share** a link.

## Architecture notes

- **Security boundary**: `lib/supabase/server.ts` (session, RLS-respecting) vs.
  `lib/supabase/admin.ts` (service-role, bypasses RLS — server-only). Every
  privileged write verifies ownership via the session first.
- **Recordings are the source of truth; chapters are derived** and regenerable
  from transcripts + the voice profile. Generated text and manual edits are
  stored separately (`chapters.generated_text` / `edited_text`).
- **Long-running work** (transcribe, AI) is tracked in a `jobs` table and runs
  in Node-runtime Route Handlers with a generous `maxDuration`.
- **Uploads** go directly from the browser to Storage via short-lived signed
  URLs minted by `/api/uploads/sign`.
- **Voice profile** (`lib/anthropic/prompts.ts`, `lib/generation.ts`) is
  re-derived and version-bumped as new transcripts appear, so regenerations
  stay consistent.

### The no-fabrication guarantee

`lib/anthropic/prompts.ts` enforces, in every generation prompt, that Claude may
fix filler/grammar and reorder for flow but must **never add facts, names,
dates, places, or events not present in the transcript**. When the transcript is
thin, it produces a short chapter rather than padding it.

## Real vs. stubbed

| Piece | Status |
| --- | --- |
| Auth, DB, Storage, RLS, recording, transcription, AI rewrite, PDF, sharing, photos, QR | **Implemented** |
| Print-on-demand vendor upload (KDP/Lulu) | Stubbed — produces a print-ready PDF; add a `publish` adapter |
| Zoom meeting creation + scheduler (Cal.com/Calendly) | Stubbed config in `lib/interview/` — manual date picker works today |
| Zoom recording ingestion | Real webhook (`/api/webhooks/zoom`); needs `ZOOM_*` creds + signature HMAC hardening |

## Project layout

```
app/            routes: (auth), (app) shell, api/*, share, book/print
components/     ui, recorder, story, dashboard, book, settings, interviews
lib/            supabase clients, anthropic (prompts + rewrite), transcription,
                generation, book assembly, pdf, storage, qr, jobs, types
supabase/       migrations/0001_init.sql
```
