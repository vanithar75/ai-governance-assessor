# Phase 2 — Version lifecycle, crosswalk, RAG, and curation

Phase 2 extends the Git-as-source-of-truth standards pipeline with version lifecycle controls, PR validation, cross-framework mappings, RAG ingestion foundations, and an AI-assisted curation script. All features remain compatible with the **Supabase free tier**.

## Features

| Feature | Description |
|---------|-------------|
| Version lifecycle | `manifest.yaml` supports `draft`, `published`, `archived`; publish archives prior published versions |
| Latest published view | `frameworks_with_questions` exposes only the latest **published** version per framework |
| Dashboard version label | Framework cards show version string (e.g. `v1.0`) |
| PR validation | GitHub Action runs `validate-standards` (dry-run) on PRs touching `standards/**` |
| Control crosswalk | `standards/mappings/*.yaml` → `control_mappings` table; UI on assessment detail + `/standards/mappings` |
| RAG ingestion | `source_documents` + `document_chunks` tables; `ingest-sources` script for markdown excerpts |
| Curation agent (MVP) | `draft-control-updates` suggests control improvements via LLM or prints manual workflow |

## Setup

### 1. Run migrations (Supabase SQL Editor, in order)

1. `supabase/migrations/001_framework_versions_and_controls.sql` (if not already applied)
2. `supabase/migrations/002_phase2_version_lifecycle.sql` — latest published view
3. `supabase/migrations/003_phase2_rag_ingestion.sql` — RAG tables + pgvector extension

### 2. Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Client-side auth and reads |
| `SUPABASE_SERVICE_ROLE_KEY` | publish/ingest | Service role for publish, mappings, and ingest scripts |
| `OPENAI_API_KEY` | optional | Embeddings in `ingest-sources`; LLM suggestions in `draft-control-updates` |

Copy `.env.local.example` → `.env.local` and fill in values.

### 3. Publish pipeline commands

```bash
# Validate YAML (no DB writes) — also used by PR CI
npm run validate-standards

# Publish standards from Git
npm run publish-standards

# Force publish a draft as published (archives prior published version)
npm run publish-standards -- --framework=nist-ai-rmf --version=1.1 --status=published

# Publish cross-framework mappings (after standards are in DB)
npm run publish-mappings

# Ingest source excerpts into RAG tables
npm run ingest-sources

# Draft control improvements (LLM or manual instructions)
npm run draft-control-updates -- --framework=nist-ai-rmf --version=1.0
```

### 4. GitHub Actions

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/validate-standards.yml` | PR changing `standards/**` | Dry-run validation; no Supabase secrets required |
| `.github/workflows/publish-standards.yml` | Push to `main` | Publishes standards after merge |

## Version lifecycle

```
draft  →  review (PR)  →  published  →  archived (superseded)
```

- **draft** — stored in DB when published via pipeline, but **not** shown on the dashboard (`frameworks_with_questions` filters to latest published only).
- **published** — served to the app; publishing a new `published` version archives the previous one for the same framework.
- **archived** — retained for assessments pinned to `framework_version_id`; skipped by default on publish (use `--status` to override).

`manifest.yaml` example:

```yaml
version: "1.0"
status: published
changelog: Initial release.
published_at: 2024-06-01T00:00:00.000Z
```

## Cross-framework mappings

Mappings live in `standards/mappings/` as YAML crosswalk files. Each entry references framework slug, version, and `control_id` on both sides.

After publishing standards, run:

```bash
npm run publish-mappings
```

The app shows related controls on completed assessment detail pages and provides a browse view at `/standards/mappings`.

## RAG ingestion

Place short markdown excerpts (public-domain summaries, not full copyrighted PDFs) under:

```
standards/sources/
  nist-ai-rmf/
  eu-ai-act/
  iso-42001/
```

Run `npm run ingest-sources` to chunk and store content. With `OPENAI_API_KEY`, chunks include `text-embedding-3-small` vectors (`vector(1536)`); without it, chunks are stored as text only for MVP.

## AI-native curation workflow

1. **Add or refresh sources** — drop markdown excerpts in `standards/sources/{framework}/`.
2. **Ingest** — `npm run ingest-sources -- --framework=nist-ai-rmf`.
3. **Draft updates** — `npm run draft-control-updates` reads sources + current `controls.yaml`.
   - With `OPENAI_API_KEY`: outputs proposed title/guidance improvements (stdout or `standards/drafts/`).
   - Without: prints step-by-step manual curation instructions.
4. **Validate** — `npm run validate-standards` (Zod schema checks).
5. **PR review** — keep `status: draft` until approved.
6. **Publish** — merge and run `publish-standards` (or CI on `main`).

**Stable `control_id` values** remain immutable across versions so assessment answers stay reproducible.

## Directory layout (Phase 2)

```
standards/
  <framework>/
    framework.yaml
    versions/<version>/
      manifest.yaml
      controls.yaml
  mappings/
    nist-iso-eu-crosswalk.yaml
  sources/
    <framework>/*.md
  drafts/          # optional LLM suggestion output
```

## Free tier notes

- pgvector is available on Supabase free tier; embeddings are optional at ingest time.
- Source excerpts are small markdown snippets — well within 500 MB database limits.
- PR validation dry-run requires no service role key.

## Related docs

- Phase 1 setup: `docs/PHASE1.md`
- Standards authoring: `standards/README.md`
