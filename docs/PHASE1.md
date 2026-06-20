# Phase 1 — Assessment history, drafts, evidence, CI publish

Phase 1 features run on the **Supabase free tier** (500 MB database, 1 GB storage, 50k MAU). Typical usage — draft/completed assessments, JSONB answers, and PDF/image evidence — stays well within those limits.

## Features

| Feature | Description |
|---------|-------------|
| Assessment history | Dashboard lists past assessments with framework, score, status, and date |
| Assessment detail | `/assessments/[id]` shows completed report, section scores, and answers |
| Draft save/resume | Auto-save on answer/section change; one active draft per user per framework version |
| Evidence uploads | Optional file per question in private `assessment-evidence` bucket |
| CI publish | GitHub Action publishes `standards/**` to Supabase on push to `main` |

## Setup

### 1. Database (if not already applied)

Run in Supabase SQL Editor, in order:

1. `supabase/setup-all.sql` (or `schema.sql` + `migrations/001_...`)
2. `supabase/storage.sql` — storage bucket, RLS, and draft unique indexes

### 2. Storage bucket

`supabase/storage.sql` creates:

- Private bucket `assessment-evidence` (10 MB per file, common document/image types)
- RLS: users read/write only under `{user_id}/...`
- Partial unique indexes for one active draft per user + framework version

### 3. GitHub secrets (CI publish)

In the repo **Settings → Secrets and variables → Actions**, add:

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for `publish-standards` (never expose client-side) |

The workflow `.github/workflows/publish-standards.yml` runs `npm run publish-standards` when `standards/**` changes on `main`.

### 4. Local env

Copy `.env.local.example` → `.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for local `publish-standards` only)

## Free tier notes

- **Database**: Assessment rows and JSONB reports are small; hundreds of assessments fit easily in 500 MB.
- **Storage**: 1 GB total for evidence; encourage PDFs/images under 10 MB each (enforced by bucket limit).
- **Auth**: Email/password or OAuth within 50k MAU.
- **Edge/serverless**: Next.js on Vercel free tier pairs well; no Supabase paid features required for Phase 1.

## User flows

1. **Start assessment** — If a draft exists, choose Resume or Start fresh.
2. **During assessment** — Answers auto-save as `draft` / `in_progress`; optional evidence per question.
3. **Submit** — Status becomes `completed` with score and report; appears on dashboard.
4. **View history** — Click a completed row to open `/assessments/[id]`.
