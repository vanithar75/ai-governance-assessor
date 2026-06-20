# Cursor Cloud Agent setup — AI Governance Assessor

Guide for running [Cursor Cloud Agents](https://cursor.com/agents) against `vanithar75/ai-governance-assessor` on branch **`main`**.

## Quick facts

| Item | Value |
|------|-------|
| Repository | https://github.com/vanithar75/ai-governance-assessor |
| Default branch (GitHub API) | `main` |
| Repo config | `.cursor/environment.json` → `npm ci` on startup |
| Agent instructions | `AGENTS.md` (includes cloud-specific section) |

Verify default branch anytime:

```bash
curl -s -H "User-Agent: curl" \
  https://api.github.com/repos/vanithar75/ai-governance-assessor \
  | jq -r .default_branch
# Expected: main
```

PowerShell:

```powershell
(Invoke-RestMethod -Uri 'https://api.github.com/repos/vanithar75/ai-governance-assessor' -Headers @{ 'User-Agent'='curl' }).default_branch
```

---

## Step 1 — Connect GitHub in Cursor

1. Open **https://cursor.com/dashboard** → **Cloud Agents** (or **Integrations**).
2. Connect **GitHub** and install the **Cursor GitHub App**.
3. Under **Repository access**, include **`vanithar75/ai-governance-assessor`** (all repos or selected repos).
4. Confirm the repo appears in the Cloud Agents repo picker.

If setup fails with **"Could not resolve default branch"** or **"Error loading default branch"**:

- This is a [known Cursor issue](https://forum.cursor.com/t/cursor-cloud-agent-fails-with-error-loading-default-branch-during-environment-setup/154051) when the GitHub installation token cannot resolve the default branch.
- **Workaround:** type **`main`** explicitly in the branch field when starting an agent — do not rely on auto-detect.
- Reinstall the Cursor GitHub App if needed; retry later if the backend token is stale.
- Ensure GitHub **Settings → Branches → Default branch** is **`main`** (verified via API as of June 2026).
- This repo still has a legacy **`master`** branch; only **`main`** is the GitHub default. Prefer deleting `master` after confirming nothing references it.

---

## Step 2 — Create or reuse a Cloud environment

### Option A — Repo-level config (committed)

This repo includes:

```json
// .cursor/environment.json
{
  "install": "npm ci"
}
```

Cursor resolves environments in order: **repo `.cursor/environment.json`** → personal saved environment → team saved environment.

### Option B — Dashboard agent-led setup

1. Cloud Agents dashboard → **New environment** (or **Update with Agent**).
2. Select **`vanithar75/ai-governance-assessor`**.
3. Let the agent install dependencies and verify `npm run build`.
4. Save a snapshot when prompted; optionally add the snapshot ID to `.cursor/environment.json`.

---

## Step 3 — Add secrets (Supabase)

**Cursor Dashboard → Cloud Agents → your environment → Secrets**

Add (names must match exactly):

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server scripts (`publish-standards`, etc.) — never expose to client |
| `OPENAI_API_KEY` | Optional — RAG ingest / draft-control scripts |

See `docs/PHASE1.md` and `docs/PHASE2.md` for what each variable enables.

**Do not** commit `.env.local` or API keys to Git. GitHub Actions uses separate repo secrets under **Settings → Secrets and variables → Actions**.

---

## Step 4 — Dashboard defaults

In **Cloud Agents → Default settings**:

| Setting | Recommended value |
|---------|-------------------|
| Default repository | `vanithar75/ai-governance-assessor` |
| Base branch | `main` |

Note: some UI branch dropdowns still default to GitHub’s configured branch; if auto-detect fails, always type **`main`**.

---

## How to start a Cloud Agent

### From Cursor Desktop (IDE)

1. Open the **Agents** panel (or Agent chat).
2. In the **agent mode dropdown**, choose **Cloud** (not Local / Background-only).
3. Select repository **`vanithar75/ai-governance-assessor`** and branch **`main`**.
4. Paste your task prompt (see [Ready-to-paste Sprint 3 prompt](#ready-to-paste-sprint-3-prompt) below).
5. The agent runs on a Cursor-hosted VM, commits to a branch, and can open a PR.

You can also start guided environment setup from the Agents window (**Setup environment** flow).

### From cursor.com/agents (web)

1. Go to **https://cursor.com/agents**.
2. **Repository:** `vanithar75/ai-governance-assessor`
3. **Branch:** type **`main`** explicitly
4. Paste the prompt below and start.

### From this chat / local Agent session

The default Cursor chat agent runs **locally** in your IDE session. It **cannot** spawn a Cloud Agent VM unless you use the **Cloud** mode in the agent dropdown or the SDK/API below.

---

## Ready-to-paste Sprint 3 prompt

Use at **cursor.com/agents** or **IDE → Agent → Cloud** with branch **`main`**:

```text
Repository: vanithar75/ai-governance-assessor
Branch: main

Implement Sprint 3 epic: RFP Customer Assessment Mode (presales use case).

Notion hub (acceptance criteria & backlog):
https://app.notion.com/p/385818bdc73d81529bbfdaa17f01cbf1
Stories database: https://app.notion.com/p/76f5b571a6e14f4d8643e3de689d0d1a
Epic: RFP Response & Customer Assessment Mode

Start with P0 Sprint 3 story "Customer-facing assessment mode toggle" (5 pts):
- Toggle internal vs customer-facing assessment modes
- Customer mode hides admin features and uses simplified UI

Context:
- Presales SA assesses customer AI requirements against NIST AI RMF, EU AI Act, ISO 42001
- Identify high-risk use cases and non-compliance for RFP responses
- Read docs/PHASE2.md, docs/PHASE1.md, AGENTS.md, existing app in app/ and components/

Deliverables (MVP for this run):
1. Customer/org profile on new assessment (company name, RFP reference, industry)
2. Assessment tagged as "customer" vs "internal" (persist in Supabase)
3. Summary view highlighting high-risk gaps and non-compliance flags
4. Open a PR to main when done

Verification:
- npm run lint
- npm run build
- npm run validate-standards

Do not commit secrets. Match existing Next.js App Router + Supabase + shadcn patterns.
```

Follow-up runs can target other Sprint 3 stories (RFP questionnaire templates, customer branding, etc.) from the same Notion epic.

---

## Programmatic start (Cursor SDK / API)

Requires **`CURSOR_API_KEY`** in your environment — **never** commit it to the repo.

Get a key: **https://cursor.com/dashboard** → **Integrations** (user API key) or team service account.

### TypeScript (`@cursor/sdk`)

```typescript
import { Agent } from "@cursor/sdk";

const result = await Agent.prompt(
  `Implement Sprint 3 RFP Customer Assessment Mode. Branch: main. Read docs/PHASE2.md and AGENTS.md.`,
  {
    apiKey: process.env.CURSOR_API_KEY!,
    model: { id: "composer-2.5" },
    cloud: {
      repos: [
        {
          url: "https://github.com/vanithar75/ai-governance-assessor",
          startingRef: "main",
        },
      ],
    },
  },
);

console.log(result.status, result.result);
```

### Python (`cursor-sdk`)

```python
import os
from cursor_sdk import Agent, AgentOptions, CloudAgentOptions, CloudRepoOptions

result = Agent.prompt(
    "Implement Sprint 3 RFP Customer Assessment Mode. Read docs/PHASE2.md.",
    AgentOptions(
        api_key=os.environ["CURSOR_API_KEY"],
        model="composer-2.5",
        cloud=CloudAgentOptions(
            repos=[
                CloudRepoOptions(
                    url="https://github.com/vanithar75/ai-governance-assessor",
                    starting_ref="main",
                )
            ]
        ),
    ),
)
print(result.status, result.result)
```

### REST API

See [Cloud Agents API endpoints](https://cursor.com/docs/cloud-agent/api/endpoints). Pass `startingRef: "main"` (or equivalent) on the repo object.

---

## IDE vs web — can chat start Cloud Agents?

| Method | Starts Cloud Agent VM? | Updates GitHub repo? |
|--------|------------------------|----------------------|
| **IDE → Agent dropdown → Cloud** | Yes | Yes (branch + PR) |
| **cursor.com/agents** | Yes | Yes (branch + PR) |
| **IDE chat in Local mode** | No (local session) | Only if you push manually |
| **Cursor SDK / REST with `CURSOR_API_KEY`** | Yes | Yes |
| **This subagent / background task chat** | No | Only via git push from your machine |

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Could not resolve default branch | Cursor GitHub token / stale `master` vs `main` | Type **`main`** manually; reconnect GitHub App |
| Environment setup fails | Missing secrets or failed `npm ci` | Add Supabase secrets; check agent setup logs |
| Agent cannot push | GitHub App lacks write access | Reinstall app with repo write permission |
| `npm run build` fails in cloud | Missing env vars | Add `NEXT_PUBLIC_*` secrets |

---

## Related links

- [Cloud environment setup](https://cursor.com/docs/cloud-agent/setup)
- [Cloud agent dashboard settings](https://cursor.com/docs/cloud-agent/settings)
- [Cursor SDK TypeScript](https://cursor.com/docs/sdk/typescript)
- [Project Phase 2 doc](./PHASE2.md)
