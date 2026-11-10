# Codex instructions — HMS-Insights

This repository contains several cooperating HERO Management System (HMS) companion tools. It is **not** the HMS core backend. Start with [project-docs/HMS_OVERVIEW.md](project-docs/HMS_OVERVIEW.md) and read only the feature-specific references needed for the task.

## Working principles
- First locate the existing implementation, route, tests and documentation. Prefer extending them to creating another application or copy.
- Preserve multi-organisation isolation. Never silently fall back to PHM data for an unknown or unconfigured organisation. Confirm organisation identity server-side.
- Keep HMS credentials, admin secrets and other privileged values server-side. Do not commit secrets or expose protected data through public URLs, logs or client bundles.
- Do not change public routes, legacy aliases, permissions, database schema, environment variables or deployment configuration unless necessary for the requested task; explain any such change.
- Distinguish existing verified behaviour from proposals. Do not claim features, deployment or API fields are live without verification.
- Prefer small, scoped changes with regression tests. Preserve existing URLs and behaviour unless the task explicitly requests otherwise.
- When requirements are unclear, inspect the existing code and docs, choose the smallest reversible implementation and state assumptions. Ask only when a decision is high-risk or genuinely blocks progress.

## Task workflow
1. Identify requested outcome, boundaries and acceptance criteria.
2. Read only the relevant references from [project-docs/APPLICATIONS.md](project-docs/APPLICATIONS.md); inspect the actual code before editing.
3. Implement the smallest cohesive change; avoid unrelated refactors.
4. Verify using targeted tests, then `npm test` when feasible. This Node.js 20+ project uses `npm start`; see `package.json` for available commands.
5. Summarise files changed, tests run, unverified points and any deployment/configuration actions required.
6. Update the relevant existing documentation only when behaviour or contracts actually changed. Do not inflate this file with feature histories.

## Source-of-truth priority
Current code/configuration and tests > feature-specific docs > overview documents > chat history. Flag discrepancies instead of inventing facts.

## Where to look
- [HMS overview](project-docs/HMS_OVERVIEW.md)
- [Application-to-document index](project-docs/APPLICATIONS.md)
- Existing feature docs are mostly in `docs/*.md`. **Caution:** `docs/` also contains GitHub Pages/static assets; do not restructure it casually.
- Runtime: `src/`, `api/`, `public/`; tests: `test/`; deployment: `vercel.json`, `VERCEL_SETUP.md`.

## Git and deployment
Prefer a feature branch and reviewable PR. Do not merge, deploy, or change secrets on behalf of the user unless the specific task authorises that action.
