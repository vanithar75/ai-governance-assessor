# Cursor Cloud Agent setup — AI Governance Assessor

Guide for running [Cursor Cloud Agents](https://cursor.com/agents) against `vanithar75/ai-governance-assessor` on branch **`main`**.

## Quick facts

| Item | Value |
|------|-------|
| Repository | https://github.com/vanithar75/ai-governance-assessor |
| Visibility | Public |
| Default branch (GitHub API) | **`main`** |
| Remote branches (verified) | **`main` only** — legacy `master` removed from GitHub |
| Remote `HEAD` symref | `refs/heads/main` |
| Repo config | `.cursor/environment.json` → `npm ci` on startup |
| Agent instructions | `AGENTS.md` (includes cloud-specific section) |

### Verified GitHub state (June 2026)

```text
# GitHub REST API
GET https://api.github.com/repos/vanithar75/ai-governance-assessor
→ default_branch: "main"

# Local remote check
git ls-remote --symref origin HEAD
→ ref: refs/heads/main  HEAD

git ls-remote --heads origin
→ refs/heads/main  (only branch on remote)
```

If Cursor still shows **“Could not resolve default branch”**, the repo metadata is correct — the failure is almost always **Cursor’s GitHub App / dashboard connection**, not a missing branch on GitHub.

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

## Step 1 — Connect GitHub in Cursor (required)

Cloud Agents need GitHub connected at **cursor.com**, not only in the desktop IDE.

### Exact click path

1. Sign in at **https://cursor.com/dashboard**.
2. Open **Integrations**: **https://cursor.com/dashboard/integrations**
3. Under **GitHub**, click **Connect** (or **Manage** if already connected).
4. Install or configure the **Cursor GitHub App**: **https://github.com/apps/cursor**
5. On GitHub’s install screen, choose **All repositories** or **Only select repositories** and include **`vanithar75/ai-governance-assessor`**.
6. Grant **read and write** access (required for agents to push branches and open PRs).
7. Return to **https://cursor.com/dashboard/cloud-agents** → confirm the repo appears in the repository picker.

### Confirm GitHub repo default (optional sanity check)

On GitHub: **Repository → Settings → General → Default branch** should show **`main`**.

Direct link: **https://github.com/vanithar75/ai-governance-assessor/settings**

If it ever shows `master`, change it to **`main`** (Save). As of June 2026 the API already reports `main`; no `gh` CLI needed.

### If you see “Could not resolve default branch”

This is a [known Cursor backend issue](https://forum.cursor.com/t/cursor-cloud-agent-fails-with-error-loading-default-branch-during-environment-setup/154051): the GitHub installation token sometimes fails to resolve the default branch during environment setup — **even when GitHub’s default is correct**.

| Fix | Action |
|-----|--------|
| **1. Type branch manually** | In agent start or environment setup, enter **`main`** — never leave the branch field blank. |
| **2. Reconnect dashboard GitHub** | **https://cursor.com/dashboard/integrations** → Disconnect GitHub → Connect again (not the same as only reinstalling on GitHub). |
| **3. Reinstall GitHub App** | **https://github.com/settings/installations** → Cursor → Configure → ensure **`ai-governance-assessor`** is in scope with write access. |
| **4. Set dashboard defaults** | **https://cursor.com/dashboard/cloud-agents** → Default settings → Base branch = **`main`**, Default repository = **`vanithar75/ai-governance-assessor`**. |
| **5. Retry later** | Transient GitHub API / token issues sometimes clear after minutes or hours. |
| **6. Contact support** | Copy the **Request ID** from a failed run URL on **https://cursor.com/agents** and email support. |

**Not the cause (verified for this repo):** missing README, wrong default branch on GitHub, or legacy `master` branch — remote has **`main` only**.

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

### “Could not resolve branch” / “Could not resolve default branch”

These messages appear **before** the Cloud Agent VM starts — during GitHub App token resolution. They are **not** caused by missing `environment.json`, failed `npm ci`, or a wrong default branch on GitHub for this repo.

**Verified repo state (June 2026 — re-run commands below if unsure):**

| Check | Result |
|-------|--------|
| `default_branch` (GitHub API) | **`main`** |
| Remote branches (`git ls-remote --heads origin`) | **`main` only** — `master` deleted |
| `HEAD` symref | `refs/heads/main` |
| Visibility | **Public** |
| `main` protected? | **No** |
| Commits on `main`? | **Yes** — latest on `main` is `be013f5…`; ancestor `0f55662…` exists |
| `.cursor/environment.json` branch field | **Not supported** — branch is set at launch (UI, dashboard Base branch, or API `startingRef`) |

```bash
# Quick re-verify (any machine)
curl -s -H "User-Agent: curl" \
  https://api.github.com/repos/vanithar75/ai-governance-assessor \
  | jq '{default_branch, private}'

git ls-remote --symref origin HEAD
git ls-remote --heads origin
```

#### Root cause hypotheses (ranked by likelihood)

1. **Stale Cursor ↔ GitHub App installation binding** — Most likely. Cursor’s backend cannot create or use the GitHub App installation token (`ERROR_GITHUB_APP_NO_ACCESS`, `Failed to create installation access token`). Common after reinstalling the app on GitHub **without** disconnecting/reconnecting at [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations), or after deleting `master` while Cursor still cached the old default.
2. **Repo not in GitHub App “selected repositories” scope** — App installed but `ai-governance-assessor` not ticked on [github.com/settings/installations](https://github.com/settings/installations) → Cursor → Configure.
3. **Dashboard GitHub connected under a different account** — Repo is under `vanithar75`; the Cursor login must be the same GitHub user (or an org admin with app access).
4. **Error during environment setup (not agent launch)** — “New environment” / “Update with Agent” auto-fetches the default branch before you can type `main`. Use [dashboard defaults](#step-4--dashboard-defaults) first, or start from [cursor.com/agents](https://cursor.com/agents) where the branch field is available earlier.
5. **Transient GitHub API / rate-limit** — Cursor staff report brief GitHub outages were misread as “branch missing”; retry after 15–60 minutes. Even explicit `main` can fail until the token recovers.
6. **IDE-only GitHub connection** — GitHub linked in Cursor Desktop but **not** at [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations). Cloud Agents use the **web dashboard** token.
7. **New-repo indexing lag** — This repo was created 2026-06-20; rare delay before the app can list branches. Usually clears within hours.
8. **Private-repo permission gap** — **Ruled out** — repo is public.
9. **Empty repo / no commits on `main`** — **Ruled out** — `main` has history including `0f55662`.
10. **Branch protection blocking reads** — **Ruled out** — `main` is unprotected.
11. **Duplicate repo name under another account** — Unlikely; ensure picker shows `vanithar75/ai-governance-assessor` exactly.

Related API errors (browser DevTools → Network on a failed start):

| Error | Meaning |
|-------|---------|
| `Failed to determine repository default branch` | Same family — token cannot read repo metadata |
| `Failed to verify existence of branch 'main'` | Token cannot list/read branches (not a wrong branch name) |
| `ERROR_GITHUB_APP_NO_ACCESS` | Installation token failure — reinstall + dashboard reconnect |
| `ERROR_GITHUB_NO_USER_CREDENTIALS` | Dashboard GitHub not connected for this user |

Forum references: [Error loading default branch](https://forum.cursor.com/t/cursor-cloud-agent-fails-with-error-loading-default-branch-during-environment-setup/154051), [Failed to determine default branch](https://forum.cursor.com/t/failed-to-determine-repository-default-branch/152319), [Can't list branches](https://forum.cursor.com/t/cursor-cant-list-branches-of-some-repos/153564), [App installed before environment creation](https://forum.cursor.com/t/new-environment-of-cloud-agent-cant-be-created-for-repositories-which-installed-the-cursor-github-app-before/161513).

#### Step-by-step fix checklist (after deleting `master`)

Work through in order; stop when agents start successfully.

| Step | Action | URL |
|------|--------|-----|
| **1** | Confirm GitHub default is `main` and only `main` exists | https://github.com/vanithar75/ai-governance-assessor/settings |
| **2** | Open Cursor **Integrations** (web dashboard, not IDE) | https://cursor.com/dashboard/integrations |
| **3** | **Disconnect** GitHub → **Connect** again → authorize `repo` + `read:org` | (OAuth on connect) |
| **4** | Install or reconfigure **Cursor GitHub App** | https://github.com/apps/cursor |
| **5** | On GitHub install screen: **Only select repositories** → tick **`ai-governance-assessor`** → Save | https://github.com/settings/installations → Cursor → **Configure** |
| **6** | Confirm **read and write** (agents need push + PR) | Same Configure screen |
| **7** | Set Cloud Agent **defaults** | https://cursor.com/dashboard/cloud-agents → **Default settings** → Default repository = `vanithar75/ai-governance-assessor`, **Base branch** = `main` (do not leave blank) |
| **8** | Link repo to a Cloud **environment** (if using environments) | https://cursor.com/dashboard/cloud-agents → **Environments** → select env → add repo |
| **9** | Start agent from web with **typed branch** | https://cursor.com/agents → Repository = `vanithar75/ai-governance-assessor` → Branch = `main` (type manually; do not wait for dropdown) |
| **10** | If environment setup still fails: skip “New environment” temporarily; launch agent directly from step 9 | — |
| **11** | Retry after 30–60 min (transient token / rate-limit) | — |
| **12** | Escalate: copy **Request ID** from failed run URL → support | hi@cursor.com |

**Full GitHub App reset (if steps 2–9 still fail):**

1. https://github.com/settings/installations → **Cursor** → **Uninstall**
2. https://cursor.com/dashboard/integrations → Disconnect GitHub
3. Wait 2 minutes
4. Reconnect at dashboard → install app fresh → select `ai-governance-assessor`
5. Set Base branch = `main` → retry https://cursor.com/agents

**Programmatic bypass (when UI is blocked):** use `startingRef: "main"` via [Cursor SDK / API](#programmatic-start-cursor-sdk--api). If this also returns 400/401, the GitHub App token is still broken — fix steps 2–5 first.

**Not fixable from this repo:** `.cursor/environment.json` has no `branch` field ([official schema](https://www.cursor.com/schemas/environment.schema.json)). Branch must be set in dashboard defaults, agent launch UI, or API.

### Other issues

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Environment setup fails (after branch resolves) | Missing secrets or failed `npm ci` | Add Supabase secrets; check agent setup logs |
| Agent cannot push | GitHub App lacks write access | Reinstall app with repo write permission |
| `npm run build` fails in cloud | Missing env vars | Add `NEXT_PUBLIC_*` secrets |
| CI publish not running on `main` push | Workflow still lists legacy `master` | `.github/workflows/publish-standards.yml` already includes both; harmless |

---

## If nothing works

If you completed the [step-by-step fix checklist](#step-by-step-fix-checklist-after-deleting-master), the [full GitHub App reset](#full-github-app-reset-if-steps-2-9-still-fail), and the [SDK bypass](#programmatic-bypass-when-ui-is-blocked) — and Cloud Agents **still** fail with **“Could not resolve branch”**, **“Could not resolve default branch”**, **“Error loading default branch”**, or **`ERROR_GITHUB_APP_NO_ACCESS`** — stop troubleshooting this repository.

**This is a known Cursor platform issue**, not something fixable from repo config. GitHub reports `default_branch: main`, only `main` exists on the remote, and `.cursor/environment.json` has no branch field. The failure happens **before** any agent VM starts, when Cursor’s backend cannot create a valid GitHub App installation token.

### What Cursor staff have confirmed (2026)

| Finding | Source |
|---------|--------|
| Stale or mismatched GitHub App installation IDs on Cursor’s backend | [Forum: branch + write access](https://forum.cursor.com/t/cloud-agents-cannot-load-default-branch-during-environment-setup-and-lose-write-access-to-github-despite-correct-app-installation-and-org-permissions/153180) |
| Transient GitHub rate-limits briefly treated as permanent branch failures — **server-side fix merged** (retry after rollout) | [Forum: failed to determine default branch](https://forum.cursor.com/t/failed-to-determine-repository-default-branch/152319) |
| Reinstalling the GitHub App without dashboard disconnect often does **not** reliably fix token binding | [Forum: error loading default branch](https://forum.cursor.com/t/cursor-cloud-agent-fails-with-error-loading-default-branch-during-environment-setup/154051) |
| Repos that had the Cursor App installed before may not appear in “New environment” until backend re-registers | [Forum: app installed before](https://forum.cursor.com/t/new-environment-of-cloud-agent-cant-be-created-for-repositories-which-installed-the-cursor-github-app-before/161513) |
| Stale secondary GitHub accounts on one Cursor login can cause persistent `ERROR_GITHUB_APP_NO_ACCESS` — may require **manual cleanup by Cursor support** | [Forum: stale GitHub account](https://forum.cursor.com/t/multi-account-issue-stale-account-in-github-intergration/153542) |

**Last-resort client-side reset** (sometimes helps; often does not): uninstall the Cursor GitHub App at [github.com/settings/installations](https://github.com/settings/installations), disconnect GitHub at [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations), clear browser cookies for `cursor.com` and `github.com`, reconnect in an incognito window, reinstall the app with **`ai-governance-assessor`** in scope.

### Escalate to Cursor support

**Email:** [hi@cursor.com](mailto:hi@cursor.com)

Copy the template below. Replace placeholders; attach a screenshot of the failed run if possible.

```text
Subject: Cloud Agent — Could not resolve branch / ERROR_GITHUB_APP_NO_ACCESS

Repository: https://github.com/vanithar75/ai-governance-assessor
Default branch (GitHub API): main (verified — only branch on remote; master deleted)
Cursor account email: [YOUR CURSOR LOGIN EMAIL]
GitHub username: vanithar75

Error message (exact text):
[PASTE FULL ERROR — e.g. "Could not resolve default branch" or ERROR_GITHUB_APP_NO_ACCESS / "Failed to create installation access token"]

Failed run Request ID (from cursor.com/agents URL or run details):
[REQUEST_ID — e.g. from URL query or run page]

Steps already tried:
- GitHub default branch confirmed main; git ls-remote shows main only
- Deleted legacy master branch on GitHub
- Reconnected GitHub at cursor.com/dashboard/integrations (disconnect → connect)
- Reinstalled Cursor GitHub App with ai-governance-assessor selected, read+write
- Set Cloud Agent defaults: repo vanithar75/ai-governance-assessor, Base branch main
- Started agent from cursor.com/agents with branch typed manually as main
- Full GitHub App uninstall + dashboard disconnect + reinstall
- [ADD ANY OTHER STEPS YOU TRIED]

Browser Network tab error (if captured):
[PASTE JSON — e.g. ERROR_GITHUB_APP_NO_ACCESS, "Failed to verify existence of branch 'main'"]

Please confirm whether my account has a stale GitHub App installation binding and whether manual cleanup is required.

Thank you.
```

### Continue development without Cloud Agent

Use **[DEVELOPMENT_WITHOUT_CLOUD_AGENT.md](./DEVELOPMENT_WITHOUT_CLOUD_AGENT.md)** for practical workflows: Cursor Desktop local agent, GitHub Codespaces, Cursor SDK with `CURSOR_API_KEY`, and Vercel deploy from GitHub.

---

## Related links

- [Develop without Cloud Agent](./DEVELOPMENT_WITHOUT_CLOUD_AGENT.md)
- [Cloud environment setup](https://cursor.com/docs/cloud-agent/setup)
- [Cloud agent dashboard settings](https://cursor.com/docs/cloud-agent/settings)
- [Cursor SDK TypeScript](https://cursor.com/docs/sdk/typescript)
- [Project Phase 2 doc](./PHASE2.md)
