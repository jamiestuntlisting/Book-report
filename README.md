# Stuntman Stories

_Working title: **The Death of the Stuntman**_

A StoryCorps-style app where professional stunt people record firsthand stories
from their careers — just by talking. Each memo is transcribed and rewritten by
Claude into a polished chapter **in the speaker's own voice** (it imitates how
they talk and never invents facts). Chapters are organized, enriched with photos
and scannable QR links, and compiled into a print-ready book you can sell.

Runs entirely on **Cloudflare** (Workers + D1 + R2 + Browser Rendering) and
deploys automatically from **GitHub** via Workers Builds. Baseline hosting
cost on the free tier: $0/month.

## What it does

- **Magic-link email login** (built-in auth on D1, emails via Resend) and
  **text-message login** (one-time code via Twilio) — unique login per
  storyteller.
- **Template starter questions** to get people talking ("How did you get into
  stunts?", "The biggest stunt you've ever done?", …).
- **Record audio or video** in the browser (or upload a file). Media is stored
  in Cloudflare R2, streamed through authenticated app routes (multipart
  upload for big videos, Range support for playback).
- **Automatic transcription** (OpenAI Whisper by default, behind a swappable
  `Transcriber` interface), with decoding biased toward stunt-industry
  vocabulary.
- **Voice-preserving AI rewrite** — Claude derives a *voice-style profile* from
  your transcripts and writes each chapter in that voice, adding no new facts.
- **Regenerate** a chapter (with optional direction) or **merge in new memos**
  to add/correct details later.
- **Edit** chapter text (Markdown) and rename chapters.
- **Organize** stories on a drag-to-reorder dashboard; assign chapter numbers
  and toggle what's included in the book.
- **Photos** and **QR-code links** inside chapters.
- **Print-ready PDF export** (KDP-style trim sizes) via Cloudflare Browser
  Rendering.
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
- **Weekly reminders** — opted-in storytellers get a weekly text (or email)
  with a story prompt and a one-tap sign-in link (Worker cron trigger).

## Tech stack

Next.js (App Router, TypeScript) on **Cloudflare Workers** via
`@opennextjs/cloudflare` · **D1** (SQLite) with Drizzle ORM · **R2** media
storage · **Browser Rendering** (PDF) · Claude (`@anthropic-ai/sdk`) · OpenAI
Whisper (transcription) · Resend (email) · Twilio (SMS, optional) · Tailwind
CSS. CI/CD via **Workers Builds** (deploys on every GitHub push).

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in your keys (used by `wrangler dev` / `npm run
preview`; put the same values in `.env.local` for `next dev`):

```bash
cp .dev.vars.example .dev.vars
```

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs session cookies + media URLs. `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Claude — chapter rewriting, voice profile, story check |
| `OPENAI_API_KEY` | Optional — transcription defaults to Workers AI Whisper; this switches to the OpenAI API |
| `RESEND_API_KEY` | Login + reminder emails (free tier at resend.com) |
| `EMAIL_FROM` | Optional custom sender once a domain is verified in Resend |
| `NEXT_PUBLIC_APP_URL` | Base URL (magic-link + share links) |
| `PDF_RENDER_TOKEN` | Shared secret gating the private print page |
| `CRON_SECRET` | Guards `/api/cron/reminders` (the Worker cron sends it) |
| `TMDB_API_KEY` | Name verification in story review (free key at themoviedb.org) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | Texted login codes + reminder texts |
| `ZOOM_*` | Optional interview integrations |

### 3. Set up the database (D1)

`db/schema.sql` creates every table and seeds the starter questions.

```bash
# Local dev database:
npm run db:local

# Production (once, against the real D1 database):
npx wrangler d1 execute stuntman-stories --remote --file=db/schema.sql
```

The D1 database id lives in `wrangler.jsonc` under `d1_databases`.

### 4. Run

```bash
npm run dev        # Next dev server (fast reload; local D1/R2 emulation)
npm run preview    # exact Workers runtime (wrangler dev over the built worker)
```

Open http://localhost:3000 (or :8787 for preview).

## Deploying (Cloudflare + GitHub)

One-time setup in the Cloudflare dashboard:

1. **Enable R2** (Storage → R2) and create a bucket named `stuntman-media`.
2. **Workers & Pages → Create → Connect to Git** → pick this repo.
   - Build command: `npx opennextjs-cloudflare build`
   - Deploy command: `npx opennextjs-cloudflare deploy`
3. In the Worker's **Settings → Variables & Secrets**, add the secrets from
   the table above (also add them under **Builds → Build variables** so
   `NEXT_PUBLIC_*` values are inlined at build time).
4. Create the D1 database (`stuntman-stories`), put its id in
   `wrangler.jsonc`, and apply `db/schema.sql` with
   `wrangler d1 execute --remote`.

Every push to the connected branch then builds and deploys automatically.
The weekly reminder cron (`triggers.crons` in `wrangler.jsonc`) and the
Browser Rendering binding deploy with it.

## End-to-end flow

1. Sign in with a magic link (or texted code).
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

- **Auth** is deliberately small and auditable (`lib/auth/`): single-use
  magic-link tokens / SMS codes (hashed at rest, 15-min expiry), 30-day
  sessions in D1, an HMAC-signed HttpOnly cookie. The middleware does a
  stateless signature check; every page/route re-verifies against D1.
- **No RLS in D1**, so authorization lives in the query layer: every read and
  write filters by the session's `user_id`. Media keys embed the owner's id
  (`<bucket>/<userId>/…`) and `/api/media` enforces it.
- **Media** is served only through app routes: session auth for the owner,
  short-lived signed URLs (HMAC) for share pages and the PDF renderer.
- **Recordings are the source of truth; chapters are derived** and regenerable
  from transcripts + the voice profile. Generated text and manual edits are
  stored separately (`chapters.generated_text` / `edited_text`).
- **Long-running work** (transcribe, AI) is tracked in a `jobs` table and runs
  inside Route Handlers on the Worker.
- **Voice profile** (`lib/anthropic/prompts.ts`, `lib/generation.ts`) is
  re-derived and version-bumped as new transcripts appear, so regenerations
  stay consistent.
- **Weekly reminders** run off the Worker's cron trigger: `worker.ts` wraps the
  OpenNext handler and adds a `scheduled` handler that calls the reminders
  route with `CRON_SECRET`.

### The no-fabrication guarantee

`lib/anthropic/prompts.ts` enforces, in every generation prompt, that Claude may
fix filler/grammar and reorder for flow but must **never add facts, names,
dates, places, or events not present in the transcript**. When the transcript is
thin, it produces a short chapter rather than padding it.

## Real vs. stubbed

| Piece | Status |
| --- | --- |
| Auth, DB, R2 media, recording, transcription, AI rewrite, PDF, sharing, photos, QR, reminders | **Implemented** |
| Print-on-demand vendor upload (KDP/Lulu) | Stubbed — produces a print-ready PDF; add a `publish` adapter |
| Zoom meeting creation + scheduler (Cal.com/Calendly) | Stubbed config in `lib/interview/` — manual date picker works today |
| Zoom recording ingestion | Real webhook (`/api/webhooks/zoom`); needs `ZOOM_*` creds + signature HMAC hardening |

## Project layout

```
app/            routes: (auth), (app) shell, api/*, share, book/print
components/     ui, recorder, story, dashboard, book, settings, interviews
lib/            auth (sessions/tokens/cookies), db (drizzle schema), cf
                (bindings), media (R2), anthropic (prompts + rewrite),
                transcription, generation, book assembly, pdf, qr, jobs, types
db/             schema.sql (D1 DDL + seed)
worker.ts       custom Worker entrypoint (OpenNext handler + cron)
wrangler.jsonc  bindings: DB (D1), MEDIA (R2), BROWSER, cron trigger
```
