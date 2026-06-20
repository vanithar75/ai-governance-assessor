# Cursor Cloud Agent — support escalation

Use this page when [CURSOR_CLOUD_AGENT.md](./CURSOR_CLOUD_AGENT.md) troubleshooting does not fix **“Could not resolve default branch”** (or related errors). GitHub metadata for this repo is correct; the failure is on Cursor’s side during GitHub App token / default-branch resolution **before** any agent VM starts.

For day-to-day development while blocked, see [DEVELOPMENT_WITHOUT_CLOUD_AGENT.md](./DEVELOPMENT_WITHOUT_CLOUD_AGENT.md).

---

## Verified GitHub state (re-run anytime)

**Date last verified:** 2026-06-21

| Check | Command / source | Result |
|-------|------------------|--------|
| Default branch | `GET https://api.github.com/repos/vanithar75/ai-governance-assessor` | **`main`** |
| All remote branches | `GET …/branches?per_page=100` | **`main` only** (legacy `master` removed) |
| `HEAD` symref | `git ls-remote --symref origin HEAD` | `ref: refs/heads/main` |
| Visibility | GitHub API `private` | **`false`** (public) |
| Archived / disabled | GitHub API | **`false`** |
| Repo config | `.cursor/environment.json` | `{ "install": "npm ci" }` — **no branch field** ([schema](https://www.cursor.com/schemas/environment.schema.json)) |

PowerShell quick check:

```powershell
(Invoke-RestMethod -Uri 'https://api.github.com/repos/vanithar75/ai-governance-assessor' -Headers @{ 'User-Agent'='curl' }).default_branch
# Expected: main

(Invoke-RestMethod -Uri 'https://api.github.com/repos/vanithar75/ai-governance-assessor/branches?per_page=100' -Headers @{ 'User-Agent'='curl' }).name
# Expected: main
```

```bash
curl -s -H "User-Agent: curl" \
  https://api.github.com/repos/vanithar75/ai-governance-assessor \
  | jq '{default_branch, private, archived}'

git ls-remote --symref origin HEAD
git ls-remote --heads origin
```

---

## Error variants (same root cause family)

Paste the **exact** string from the UI, toast, or browser Network tab:

| User-facing / API message | When it appears |
|---------------------------|-----------------|
| **Could not resolve default branch** | Agent start, environment setup, repo picker |
| **Could not resolve branch** | Same stage; sometimes after typing a branch |
| **Error loading default branch** | “New environment” / “Update with Agent” during setup |
| **Failed to determine repository default branch** | Backend / Network response |
| **Failed to verify existence of branch 'main'** | Token cannot list branches (not a wrong branch name) |
| **`ERROR_GITHUB_APP_NO_ACCESS`** | Installation token creation failed |
| **`Failed to create installation access token`** | Same as above |
| **`ERROR_GITHUB_NO_USER_CREDENTIALS`** | Dashboard GitHub not connected for this Cursor login |
| **Unable to resolve default branch** | Dashboard / Cloud Agent onboarding (wording variant) |

Related forum threads: [154051](https://forum.cursor.com/t/cursor-cloud-agent-fails-with-error-loading-default-branch-during-environment-setup/154051), [152319](https://forum.cursor.com/t/failed-to-determine-repository-default-branch/152319), [153564](https://forum.cursor.com/t/cursor-cant-list-branches-of-some-repos/153564), [153180](https://forum.cursor.com/t/cloud-agents-cannot-load-default-branch-during-environment-setup-and-lose-write-access-to-github-despite-correct-app-installation-and-org-permissions/153180), [161513](https://forum.cursor.com/t/new-environment-of-cloud-agent-cant-be-created-for-repositories-which-installed-the-cursor-github-app-before/161513), [153542](https://forum.cursor.com/t/multi-account-issue-stale-account-in-github-intergration/153542).

---

## Steps already tried (checklist for support email)

Check every item you completed before emailing support:

- [ ] GitHub **Settings → General → Default branch** = `main` — https://github.com/vanithar75/ai-governance-assessor/settings
- [ ] GitHub API confirms `default_branch: main` and only `main` exists (see above)
- [ ] Deleted legacy `master` branch on GitHub (remote is `main` only)
- [ ] **Disconnect → Connect** GitHub at https://cursor.com/dashboard/integrations (web dashboard, not IDE-only)
- [ ] Reinstalled **Cursor GitHub App** — https://github.com/apps/cursor
- [ ] App scope: **Only select repositories** → `ai-governance-assessor` ticked — https://github.com/settings/installations → Cursor → Configure
- [ ] App permissions: **read and write** on repository contents
- [ ] Cloud Agent **Default settings**: repo = `vanithar75/ai-governance-assessor`, **Base branch** = `main` (not blank) — https://cursor.com/dashboard/cloud-agents
- [ ] Started agent from https://cursor.com/agents with branch **typed manually** as `main`
- [ ] Skipped “New environment” and launched agent directly from web UI
- [ ] **Full reset:** uninstall Cursor GitHub App → disconnect dashboard GitHub → wait 2 min → reconnect → reinstall app → retry
- [ ] Cleared cookies for `cursor.com` / `github.com`; retried in incognito
- [ ] Waited 30–60 minutes (transient GitHub API / rate-limit)
- [ ] SDK/API with explicit `startingRef: "main"` (if applicable) — same error ⇒ token binding still broken
- [ ] Captured **Request ID** from failed run URL on https://cursor.com/agents
- [ ] Captured Network tab JSON for failed start (see email template)

---

## Isolation test (account-level vs repo-level)

If support needs to know whether the bug is **this repository** or **your Cursor account / GitHub App binding**, run this controlled test:

### Procedure

1. Create a **new public GitHub repository** under the same account (`vanithar75`):
   - Name example: `cursor-cloud-agent-isolation-test`
   - Initialize with **README only**
   - Default branch: **`main`** (GitHub default for new repos)
   - No `.cursor/` folder, no secrets, no extra branches
2. Install or extend the **Cursor GitHub App** to include this new repo (read + write).
3. At https://cursor.com/dashboard/cloud-agents → add repo to defaults or start a one-off agent:
   - Repository: `vanithar75/cursor-cloud-agent-isolation-test`
   - Branch: type **`main`** manually
4. Record outcome.

### Interpretation

| Outcome | Likely cause |
|---------|----------------|
| **Isolation repo also fails** with “Could not resolve default branch” / `ERROR_GITHUB_APP_NO_ACCESS` | **Account-level** Cursor ↔ GitHub App binding bug — stale installation ID, multi-account GitHub link, or backend token issue. Not fixable from repo config. |
| **Isolation repo succeeds**, **`ai-governance-assessor` still fails** | **Repo-specific** registration / indexing issue on Cursor backend (e.g. app installed before repo existed, cached old default `master`). |
| **Both succeed** | Transient issue or fixed by reconnect — retry original repo. |

Include isolation test results in the support email (repo URL, pass/fail, error text if fail).

---

## Ready-to-copy email to Cursor support

**To:** [hi@cursor.com](mailto:hi@cursor.com)

Replace every `[BRACKET]` placeholder before sending. Attach a screenshot of the failed run and, if possible, a redacted Network tab response.

```text
Subject: Cloud Agent — Unable to resolve default branch / ERROR_GITHUB_APP_NO_ACCESS

Hello Cursor support,

Cloud Agents fail before any VM starts when I use my repository. GitHub reports the correct default branch; I believe this is a GitHub App installation token or backend binding issue on your side.

--- Account ---
Cursor login email: [YOUR CURSOR ACCOUNT EMAIL]
GitHub username: vanithar75
Plan / team (if applicable): [PRO / TEAM / BUSINESS / FREE]

--- Primary repository ---
URL: https://github.com/vanithar75/ai-governance-assessor
Visibility: public
GitHub API default_branch: main (verified 2026-06-21)
Remote branches: main only (legacy master deleted)
HEAD symref: refs/heads/main
.cursor/environment.json: { "install": "npm ci" } — no branch field per official schema

--- Error (exact text) ---
[PASTE FULL UI ERROR — e.g. "Unable to resolve default branch" / "Could not resolve default branch" / "Error loading default branch"]

--- Failed run details ---
Where it failed: [cursor.com/agents / dashboard environment setup / IDE Cloud mode / SDK API]
Request ID (from run URL or run page): [REQUEST_ID]
Approximate time (UTC): [YYYY-MM-DD HH:MM UTC]
Browser / client: [Chrome / Cursor Desktop version X.Y]

--- Browser Network tab (if captured) ---
[PASTE REDACTED JSON — e.g. ERROR_GITHUB_APP_NO_ACCESS, "Failed to create installation access token", "Failed to determine repository default branch", "Failed to verify existence of branch 'main'", ERROR_GITHUB_NO_USER_CREDENTIALS]

--- Steps already tried ---
- Confirmed GitHub default branch is main; API and git ls-remote show main only
- Deleted legacy master branch on remote
- Disconnect/reconnect GitHub at https://cursor.com/dashboard/integrations (web dashboard)
- Reinstalled Cursor GitHub App with ai-governance-assessor in selected repositories, read+write
- Set Cloud Agent defaults: repo vanithar75/ai-governance-assessor, Base branch main (not blank)
- Started from https://cursor.com/agents with branch typed manually as main
- Full GitHub App uninstall + dashboard disconnect + wait + reinstall
- [ADD: SDK/API with startingRef main — result: same error / different error / not tried]
- [ADD: incognito / cookie clear — result]
- [ADD: waited and retried — result]

--- Isolation test ---
New public repo (README only on main): [https://github.com/vanithar75/cursor-cloud-agent-isolation-test OR "not yet run"]
Cursor GitHub App includes isolation repo: [yes / no]
Cloud Agent on isolation repo: [SUCCESS / FAILED — paste error if failed]

--- Questions for your team ---
1. Does my Cursor account have a stale GitHub App installation ID that needs manual cleanup?
2. Are multiple GitHub identities linked to my Cursor login, and could a stale secondary account cause ERROR_GITHUB_APP_NO_ACCESS?
3. Was this repo affected by "app installed before environment creation" backend registration (forum 161513)?
4. Can you confirm whether your GitHub App token can list branches on vanithar75/ai-governance-assessor from your side?
5. If the isolation test repo also fails, can you escalate as an account-level binding bug?

Thank you for investigating.

[YOUR NAME]
```

---

## After you send

1. Keep using [DEVELOPMENT_WITHOUT_CLOUD_AGENT.md](./DEVELOPMENT_WITHOUT_CLOUD_AGENT.md) (local Cursor Agent, Codespaces, or SDK if API works).
2. When support resolves the issue, retry https://cursor.com/agents with branch **`main`** on `vanithar75/ai-governance-assessor`.
3. Update this doc with the support ticket ID and resolution for future reference.

---

## Related docs

- [CURSOR_CLOUD_AGENT.md](./CURSOR_CLOUD_AGENT.md) — setup, troubleshooting checklist, SDK examples
- [DEVELOPMENT_WITHOUT_CLOUD_AGENT.md](./DEVELOPMENT_WITHOUT_CLOUD_AGENT.md) — work without Cloud Agent
