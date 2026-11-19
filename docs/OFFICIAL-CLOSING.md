# HMS Official Closing — V1

Implemented in this companion repository and available in isolated preview; not released to production. Closing is independent of the Site Builder's website publication and never changes games, statistics or sporting rules in HMS.

## Administration

Open `/control/apps/public-portal?org=<slug>&lang=cs` (or `lang=en`), enter the organization's existing access code and use **Closing**. Its panel works even before a portal configuration exists.

1. Load Closing and open an existing record or create a new one. The URL identifier is optional and generated automatically when empty; the form never creates an unaddressable record.
2. Choose a named competition/season and Competition, Group or Phase scope. A phase may be selected within a group or across the named groups; the server checks its unique parent. Approved history fixes the record's scope; use a separate identifier for a different scope.
3. Load HMS sources. Apply the suggested table order or enter final positions manually. Arrow buttons move teams and renumber positions; enter equal ranks explicitly for joint placements. Medals are optional and must match gold/1, silver/2 or bronze/3.
4. Choose awards using scoped player/team pairs. Points, goals and assists show statistical leaders, including ties. MVP, goalie and defenseman are manual choices, not computed sporting judgments. The goalie award requires an official goalie candidate. Empty selections skip awards; custom categories use `custom:<code>` and a title.
5. Save the draft, inspect the named review and source coverage, then validate the saved revision. Confirm finality. Joint ranks/medals require explicit consent and a reason; missing standings or player-statistics coverage additionally requires acknowledgment and a reason. All scoped teams need final positions before approval.
6. Approve and lock a new version. Approval remains private. Explicitly publish one approved version or make it private again. Publishing an older approved version provides rollback without rewriting history.
7. Reopening requires a reason and preserves all earlier versions and the existing public version. A new approval appends a new immutable snapshot. Only a draft with no approved history can be removed (soft deletion reserves its identifier).

The primary **Approve and publish on portal** button performs save (when needed), approval and publication in order. It requires the same explicit finality confirmation, coverage/tie policy and revision checks as the separate actions; failure leaves the successful preceding stage visible for correction. Confirmation checkboxes/reason survive review and validation errors. Empty version selectors show an explanation rather than a blank control. Advanced separate approval, publication and rollback controls remain available.

An already published `/league/<org>` automatically displays published Closings on its homepage and adds **Final results** navigation. Each record shows its own competition/season label, ranks/medals and player awards. These are organization-wide approved records with independent scopes, not live standings for the website's selected season. No portal settings/season selections are rewritten by Closing publication. A private Closing or a draft never appears; pausing Closing removes it from the public portal. A paused/unpublished portal remains unavailable even when its independent Closing API has a published record.

The admin credential stays in page memory and request headers. CS/EN is selected through the URL. Authentication identifies an **organization admin credential, not an individual user**; approval `actorId` is the organization's configured UUID. Reopening and publication events are private audit metadata.

## Verified HMS sources and limits

`src/app/official-closing.js` reuses the organization-bound integration catalog (`fetchOrganization` plus `fetchCompetitions`), `loadPortalHmsSeason`, public membership, official standings and official player/goalie tables. No imported-game inference or fallback to another organization's data is permitted. The membership table is mandatory; unavailable membership/hierarchy fails closed. Other unavailable tables are explicitly marked incomplete.

The HMS table's row order is a **suggestion**, not proof of final placement, tie policy or completed fixtures. V1 does not claim verified game completion or derive playoff positions from unobserved games. Combined Competition/season placement is manual because the existing standings reader verifies group/phase order. Competition scope covers one selected season. Approval records reviewed coverage and policy acknowledgment. A human confirms sporting finality.

Statistical totals come from the exact chosen scope, retain player/team identity and do not sum across transfers. Missing values remain unknown. The shared statistics reader can cache tables for up to 60 seconds; snapshots record the Closing read time and provenance. Approval reloads the verified source model and checks eligibility again. Approved snapshots detach team/player labels, selected awards, source suggestions and coverage from future HMS changes.

Optional All Stars uses a published record's identifier and a detached copy of its verified output. V1 accepts only the same organization, season and exact group; phase/competition references are rejected because monthly All Stars does not certify those scopes. The existing All Stars UI is reused via a published-identifier picker. Preview approval cannot reference production All Stars because that tool currently has no isolated preview namespace. No duplicated All Stars editor is introduced.

## API

`/api/closing` rewrites to `/api/game-summary?view=closing`; local and Vercel routing share the handler. No new Vercel function. Common query: `org=<slug>&action=<action>&instance=<identifier>&lang=cs|en`.

| Method | Action | Contract |
| --- | --- | --- |
| GET | `catalog` | Organization-verified named competition/season list |
| GET | `context` | Supply seasonId, competitionId, type, optional groupId/phaseId; returns validated hierarchy |
| GET | `sources` | Same scope query; scoped teams, candidates, suggestions, nominations and explicit provenance/coverage |
| GET | `manage` | Without instance: record list; with instance: private draft, revision, history and publication pointer |
| POST | `save` | `{revision,config}`; validated draft CRUD |
| POST | `review` | `{revision,policy}`; validates saved draft against refreshed HMS data without writing |
| POST | `approve` | `{revision,policy}`; atomically appends a snapshot and locks editing |
| POST | `reopen` | `{revision,reason}`; unlocks a working revision, preserves history |
| POST | `publish` | `{revision,version}`; chooses an existing approved public version |
| POST | `pause` | `{revision}`; makes the record private |
| POST | `delete` | `{revision}`; removes only a never-approved draft |
| GET | `public` (default) | Read-only approved public snapshot or 404 |
| GET | `list` | Only public records, using approved title/scope/version |

Every action except `public`/`list` requires the Site Builder's existing organization bearer credential and same-origin validation. Credential precedence: `HMS_<ORG>_PORTAL_ADMIN_SECRET`, then tools admin secret, then existing webhook-secret fallback. Unknown organizations fail closed. Policy fields: `confirmFinal`, `allowTies`, `acceptPartial`, `reason`.

Draft config: `{title,scope,standings:[{teamId,rank,medal}],awards:[{category,playerId,teamId,title?}],allStarsPublicationId?}`. A draft may contain `rank:null` for unplaced teams; approval rejects these. Scope includes `organization` (slug), `competitionId`, `seasonId`, `type`, and appropriate group/phase UUIDs. Ownership and parentage is verified server-side; UUID syntax alone is insufficient.

Public schema version 1 returns `{schemaVersion,org,slug,title,scope,scopeLabel?,standings,awards,allStars,provenance,approvedAt,version,teams,players}`. It excludes drafts, credential audit metadata, private reasons and revision history. Public reads use only the selected snapshot; HMS outages/changes do not rewrite it. Widgets, Social Studio and Awards can reuse this contract. The portal now has a basic native results view; configurable visual widgets and graphics remain outside V1. Portal metadata adds `hasClosing`, and portal home/closing data returns only projected approved publications.

Responses: 400 malformed input, 401 unauthorized, 403 cross-origin, 404 private/missing, 405 method mismatch, 409 revision conflict, 422 incomplete review, 423 locked edits, 503 unavailable sources/storage/migration. All use `no-store` and `nosniff`. Concurrent approvals use one compare-and-swap write.

## Storage and migration (required before deployment)

Uses existing `hms_tool_instances`, with `official-closing` only for explicit `VERCEL_ENV=production`; other environments use `official-closing-preview`. Portal/All Stars records are unchanged. The stored draft envelope contains `config`, append-only `versions`, `locked`, `publishedVersion`, `events` and optional deletion status. The generic `published` column is unused; the explicit version pointer changes atomically with the row revision.

After migration 006, apply **`db/migrations/009_official_closing.sql`** to the intended database. Its trigger rejects changes/removal of approved snapshots, record identity changes and deletion of approved history. Approval checks trigger readiness and refuses to proceed without the migration. No new secrets or environment variables. This PR does not apply migrations, merge or deploy.

Limits: 256 teams, 100 awards, 100 versions and 500 audit events per record; lists use the existing 100-row store bound. Database owners can intentionally disable triggers; protection covers ordinary application writes, not hostile database administrators.

## Verification

- `node --test` is the repository's `npm test` script. Focused tests: `test/official-closing*.test.js`.
- `scripts/verify-official-closing-ui.mjs [playwright-entry-path]` runs headless Edge against a local fixture API, tests the actual editor/lifecycle and writes desktop/mobile screenshots under ignored `artifacts/closing-qa`. `CLOSING_BROWSER_CHANNEL` may select another installed Chromium channel. Playwright is optional QA tooling, not an application dependency.
- `scripts/verify-official-closing-db.mjs [pglite-entry-path]` runs the migration on in-memory PostgreSQL: immutable history, deletion rejection, concurrent compare-and-swap, tenant/tool isolation. PGlite is optional QA tooling. It never connects to `DATABASE_URL`.
- Fixture verification uses no live HMS credentials or production database. Real-organization integration and migration rollout require verification in an authorized environment before release.
