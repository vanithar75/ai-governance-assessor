# Development without Cursor Cloud Agent

Practical workflow when [Cursor Cloud Agent](./CURSOR_CLOUD_AGENT.md) fails with **“Could not resolve branch”** or **`ERROR_GITHUB_APP_NO_ACCESS`** despite correct GitHub setup. The repo is fine; use one of the paths below instead.

## Recommended: Cursor Desktop local agent

This is the fastest path for Sprint 3+ work on this project.

1. Clone or open **`C:\Vanitha\work\Agents\AI-Governance-Assessor\ai-governance-assessor`** in **Cursor Desktop**.
2. Use **Agent** chat in **Local** mode (not Cloud).
3. Point the agent at Notion acceptance criteria and repo docs (`AGENTS.md`, `docs/PHASE1.md`, `docs/PHASE2.md`).
4. Run verification locally before pushing:

   ```bash
   npm run lint
   npm run build
   npm run validate-standards
   ```

5. Commit and push to **`main`** (or open a PR) from your machine — same outcome as a Cloud Agent PR, without the hosted VM.

**Secrets:** copy Supabase keys into `.env.local` (never commit). See `AGENTS.md` for variable names.

### Sprint 3 starting points (Notion)

| Resource | URL |
|----------|-----|
| Product hub | https://app.notion.com/p/385818bdc73d81529bbfdaa17f01cbf1 |
| Stories database | https://app.notion.com/p/76f5b571a6e14f4d8643e3de689d0d1a |
| Epic | RFP Response & Customer Assessment Mode |

Pick a P0 story (e.g. customer-facing assessment mode toggle), paste acceptance criteria into Agent chat, and implement in `app/` and `components/` following existing patterns.

---

## GitHub Codespaces (browser IDE)

Use when you want a cloud Linux dev box without Cursor Cloud Agent.

1. On GitHub: **Code → Codespaces → Create codespace on `main`** for `vanithar75/ai-governance-assessor`.
2. In the codespace terminal: `npm ci` then `npm run dev` (port 3000 forwarded automatically).
3. Install **Cursor Desktop** or use VS Code in the browser; run Agent locally against the codespace workspace, or edit and push from the codespace terminal.

Add Codespace secrets for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optional keys under **Settings → Secrets and variables → Codespaces**.

---

## Cursor SDK (programmatic Cloud Agent)

If the **dashboard UI** is blocked but your **`CURSOR_API_KEY`** and GitHub App binding work for API calls, start a cloud run from a script or CI job with an explicit branch.

1. Create an API key: [cursor.com/dashboard → Integrations](https://cursor.com/dashboard/integrations).
2. Set `CURSOR_API_KEY` in your environment (**never** commit it).
3. Copy and adapt `scripts/start-cloud-agent.ts.example` (install `@cursor/sdk` in a separate folder or add as dev dependency if you adopt this permanently).

```bash
export CURSOR_API_KEY="cursor_..."   # your key — do not commit
npx tsx scripts/start-cloud-agent.ts.example
```

If the SDK returns **400** with branch or GitHub errors, the same backend token issue affects API and UI — escalate via [CURSOR_CLOUD_AGENT.md → If nothing works](./CURSOR_CLOUD_AGENT.md#if-nothing-works).

See also [Programmatic start in CURSOR_CLOUD_AGENT.md](./CURSOR_CLOUD_AGENT.md#programmatic-start-cursor-sdk--api).

---

## Vercel deploy from GitHub (no laptop)

Ship UI changes without running the app locally:

1. Connect **Vercel** to `vanithar75/ai-governance-assessor`, production branch **`main`**.
2. Add environment variables in Vercel (same `NEXT_PUBLIC_*` Supabase vars as local).
3. Push to **`main`** — Vercel builds and deploys on each push.

Use this for preview/production hosting; you still need *some* dev environment (Desktop agent or Codespaces) to author changes.

---

## Workflow summary

```text
Notion story → Cursor Desktop Agent (local) → lint/build/validate → git push main → Vercel deploy
                     ↑
              (Codespaces if no local Node)
                     ↑
              (SDK only if API works but UI does not)
```

When Cloud Agent works again, switch back to [CURSOR_CLOUD_AGENT.md](./CURSOR_CLOUD_AGENT.md). Until then, local Agent + push to GitHub is equivalent for feature delivery on this repo.
