# HMS Official Closing — V1 (implementation in progress)

## Outcome
Create one official, reusable closing record for a season/competition, group, or phase. Its confirmed results must be independent from live score/statistics changes and reusable later by the Site Builder, public widgets, Social Studio, and Awards.

## Verified architecture
- This is the **HMS-Insights companion repository**, not the HMS core backend (see `AGENTS.md`).
- Site Builder: `/control/apps/public-portal?org=<slug>`; its draft/publication settings already have a different lifecycle and must not be repurposed as an official sporting close.
- Site Builder uses organisation-validated HMS competition/season/group/phase hierarchy (see `docs/PUBLIC-PORTAL.md`).
- All-Stars has its own verified candidates, draft and published immutable snapshots (see `docs/ALL-STARS.md`).
- Existing Vercel routes are multiplexed through `api/game-summary.js`; check Hobby function limits before adding a function.
- Shared `hms_tool_instances` persistence can likely be reused with a separate tool namespace, production/preview separation, revision checks and the existing auth pattern — inspect real handlers before implementing.
- Universal widget registry is under `public/widgets`, but **no public Closing UI or API has been connected yet**.

## Current branch contents
- `src/domain/official-closing.js`: pure input validation and snapshot assembly; no persistence, API or side effects.
- `test/official-closing.test.js`: focused domain tests (not yet executed in a runnable checkout).
- This is a **domain foundation, NOT a released V1**.

## Remaining V1 work
1. Read actual `src/web/public-portal-handler.js`, `src/web/all-stars-handler.js`, `src/app/public-portal*.js`, organisation/catalog and persistence modules. Determine the precise reusable APIs and avoid introducing alternate data stores.
2. Build server-side organisation-bound scope picker data and verify season/competition/group/phase parentage (not just UUID format). Explicitly mark partial standings/data and never infer unobserved match placement. Support Competition / Group / Phase, including phase-within-group.
3. Produce suggested order from **verified official standings** and expose provenance, coverage, ties, uncertainty. Editing order is permitted, but must never mutate source games or official HMS standings.
4. Add authenticated protected draft CRUD, revision-safe save, validation/approval, immutable versioned snapshots and a reasoned admin reopening/revision workflow. Protect organisation boundaries server-side and separate production/preview state.
5. Add structured award nominations based on legitimate scoped players and official statistics. Distinguish statistical leaders from subjective choices (MVP, goalie, defenseman), allow optional custom awards and skipped awards; integrate published All-Stars by verified reference/snapshot, never duplicate its admin UI.
6. Expose a **read-only public approved Closing contract** with private/published toggle, no drafts or secrets. Use the shared application route; no new Vercel function unless justified.
7. Add Site Builder navigation `Closing`, named pickers, editable ordered standings (including joint positions and medals), awards selection, review panel, confirmation lock, version and publish controls. Provide CS/EN. Do not disturb existing portal published configurations.
8. Add API/UI tests for mismatched scope, cross-org access, unavailable data, incomplete results, draft conflicts, concurrent approvals, duplicate medals/ranks, source data changing after approval and rollback/revisions. Run `npm test`, report output.
9. Document new API and migration/deployment requirements, then submit reviewable PR. Do not merge/deploy without authorization.

## Initial domain assumptions to revisit
- UUID-format validation is only input validation. Real ownership/membership must be checked against HMS server-side before saving/approval.
- Sharing a rank and medal is allowed for tournaments with tied bronze places. Whether additional ties or medals are allowed is policy decided at approval time.
- Custom award categories currently use `custom:<code>` and a title.
- A player award is bound to a specific player/team pair, never to a name alone.
- An approved snapshot is detached from its draft; database must enforce immutability and revision history.
- Closing and publication are independent: approval does not automatically make the results public.

## Out of scope for V1
Visual public Final Results widget, Social Studio graphic templates, historical awards pages and changes to HMS core scoring rules.
