<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repository

| Item | Value |
|------|-------|
| GitHub | https://github.com/vanithar75/ai-governance-assessor |
| Default branch | `main` |
| Stack | Next.js 16 (App Router), Supabase, Tailwind, shadcn/ui |

## Cursor Cloud specific instructions

Cloud agents clone this repo on Ubuntu and read `.cursor/environment.json` for dependency setup (`npm ci`).

### Secrets (Cursor Dashboard → Cloud Agents → Secrets)

Do **not** commit secrets. Add these in the Cursor Secrets tab for the environment scoped to this repo:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Client auth and reads |
| `SUPABASE_SERVICE_ROLE_KEY` | scripts/CI | Publish and ingest scripts only |
| `OPENAI_API_KEY` | optional | RAG embeddings and curation scripts |

### Branch

Always start cloud agents from branch **`main`**. If the dashboard shows **"Could not resolve branch"** or **"Could not resolve default branch"**, the GitHub repo is fine (`main` only) — reconnect GitHub at https://cursor.com/dashboard/integrations and type `main` explicitly in the branch field. See `docs/CURSOR_CLOUD_AGENT.md` troubleshooting.

### Verify before opening a PR

```bash
npm run lint
npm run build
npm run validate-standards
```

`npm run dev` is optional for UI work; default port 3000.

### Key docs

| Doc | Purpose |
|-----|---------|
| `docs/CURSOR_CLOUD_AGENT.md` | Cloud Agent setup, IDE vs web, SDK, troubleshooting |
| `docs/PHASE1.md` | Assessment history, drafts, evidence, CI publish |
| `docs/PHASE2.md` | Version lifecycle, mappings, RAG, curation |
| `standards/README.md` | Standards YAML authoring |

### Notion backlog

Product hub and Sprint 3 stories live in Notion (presales / RFP use case). Hub: https://app.notion.com/p/385818bdc73d81529bbfdaa17f01cbf1

When implementing Sprint 3 (RFP Customer Assessment Mode), read acceptance criteria in the Notion **Stories** database and match existing patterns in `app/`, `components/`, and `lib/`.

### Standards and CI

- YAML under `standards/**` — validate with `npm run validate-standards`
- PRs touching `standards/**` trigger `.github/workflows/validate-standards.yml`
- Merge to `main` triggers publish when standards change
