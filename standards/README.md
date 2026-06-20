# Compliance Standards (Git-as-Source-of-Truth)

This directory holds human-editable compliance framework definitions. Files here are the **authoritative source**; Supabase stores published snapshots for the running app.

## Layout

```
standards/
  <framework-slug>/
    framework.yaml              # Stable metadata (name, publisher, jurisdiction)
    versions/
      <version>/
        manifest.yaml           # Version string, status, changelog
        controls.yaml           # Sections and controls (assessment questions)
```

### Example

```
standards/
  nist-ai-rmf/
    framework.yaml
    versions/
      1.0/
        manifest.yaml
        controls.yaml
  eu-ai-act/
    ...
  iso-42001/
    ...
```

### File roles

| File | Purpose |
|------|---------|
| `framework.yaml` | Identity and catalog metadata. Optional stable `id` (UUID) keeps IDs consistent across environments. |
| `manifest.yaml` | Version lifecycle: `draft` → `published` → `archived`. |
| `controls.yaml` | Atomic requirements grouped into sections. Each control maps to one assessment question. |

## Control fields

| Field | Required | Description |
|-------|----------|-------------|
| `control_id` | yes | Stable identifier (e.g. `gov-01`). Used as answer key in assessments. |
| `title` | yes | Question text shown in the questionnaire. |
| `question_type` | yes | `yes_no`, `scale`, or `text`. |
| `weight` | no | Scoring weight (0–10, default 1). |
| `required` | no | Whether the question must be answered (default true). |
| `options` | for `scale` | Ordered scale labels. |
| `guidance` | no | Helper text for assessors. |
| `severity` | no | `critical`, `high`, `medium`, `low`, `informational`. |
| `sort_order` | no | Display order within the version. |

Validation is enforced by Zod schemas in `lib/standards/schema.ts`.

## Adding or updating a standard

1. **Create or edit files** under `standards/<slug>/`.
2. **Start in draft** — set `status: draft` in `manifest.yaml` while iterating.
3. **Validate locally** with a dry run:
   ```bash
   npm run publish-standards -- --dry-run --framework=nist-ai-rmf
   ```
4. **Open a PR** for review. Diff-friendly YAML makes control changes easy to audit.
5. **Publish** after merge (see below).

### Adding a new framework

1. Create `standards/my-framework/framework.yaml` with a unique `slug`.
2. Add `versions/1.0/manifest.yaml` and `controls.yaml`.
3. Run `npm run publish-standards -- --dry-run --framework=my-framework`.
4. Publish to Supabase when ready.

### Adding a new version

1. Copy the prior version directory: `versions/1.0/` → `versions/1.1/`.
2. Edit controls and update `manifest.yaml` (`version`, `changelog`, `status: draft`).
3. Review via PR, then publish. Publishing with `status: published` archives the previous published version for that framework.

## Versioning workflow

```
draft  →  review (PR)  →  published  →  archived (superseded)
```

- **draft** — visible only to the publish pipeline (not served to app users).
- **published** — exposed via the `frameworks_with_questions` view; only one published version per framework at a time.
- **archived** — retained for historical assessments pinned to `framework_version_id`.

Assessments store `framework_version_id` so scores remain reproducible even after a new version ships.

## Publish pipeline

### Prerequisites

1. Run the database migration: `supabase/migrations/001_framework_versions_and_controls.sql`
2. Copy `.env.local.example` → `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (service role — never commit or expose client-side)

### Commands

```bash
# Regenerate YAML from legacy seed (optional, one-time migration aid)
npm run generate-standards

# Validate all standards without writing to DB
npm run publish-standards -- --dry-run

# Publish everything
npm run publish-standards

# Publish one framework / version
npm run publish-standards -- --framework=nist-ai-rmf --version=1.0
```

The script upserts `frameworks`, `framework_versions`, and `controls`. It replaces controls for the target version on each publish (idempotent).

## AI-native curation workflow

These practices work well when using AI assistants to maintain standards:

1. **Stable IDs** — Keep `control_id` values immutable across versions; change `title`/`guidance` freely. Enables diffable migrations and answer key stability.
2. **Section-scoped edits** — Ask the model to edit one section at a time in `controls.yaml` to keep PRs reviewable.
3. **Draft first** — AI-generated controls should land as `status: draft`; human review before publish.
4. **Crosswalk in Git** — Propose `control_mappings` additions in PR descriptions or a future `mappings.yaml`; the schema supports cross-framework alignment in Supabase.
5. **Regulatory citations** — Add optional `description` on controls for legal/standard clause references; keep `title` as the assessor-facing question.
6. **Validate before publish** — Always run `--dry-run` after AI edits; Zod catches missing scale options, bad slugs, and empty sections.
7. **Changelog discipline** — Every version bump needs a `changelog` entry summarizing what changed and why.

## Database mapping

| Git file | Supabase table |
|----------|----------------|
| `framework.yaml` | `frameworks` |
| `manifest.yaml` | `framework_versions` |
| `controls.yaml` | `controls` |

The app reads published data through the `frameworks_with_questions` view, which reconstructs the legacy JSONB questionnaire shape from normalized rows.
