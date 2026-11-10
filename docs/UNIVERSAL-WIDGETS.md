# HMS Universal Widgets + Leaders V1.1

## V1.1 scope controls, layout and phases

The builder now selects competition, season, group, phase and team by name. Its
organization stays bound to the selected Site Builder organization. The protected
`/api/portal?action=widget-catalog&org=<slug>&seasonId=<uuid>` endpoint uses the same
owned catalog/directory as Leaders. UUIDs and the instance ID are in **Advanced / IDs**.
Inherited values remain absent fields; **All** stores explicit `null`. Deliberate
parent changes reset child constraints, preventing an old phase or team from
remaining attached to an unrelated group. Loading failures preserve stored settings.

Each instance has `layout: {section: 'top'|'main'|'bottom', width: 'full'|'half'|'third'}`.
Old configurations default to **Bottom / Full**, preserving their original position.
Top is before the existing homepage introduction, Main is between season cards and
partners, and Bottom is after the existing homepage content. Existing sections are
rendered once. Array order controls order within each region. One CSS Grid handles
both public and protected preview output; thirds become halves and then full rows
as space decreases. Narrow Leaders suppress their featured-player panel through
the existing responsive renderer. Layout changes follow the original draft/publish
workflow and never automatically rewrite stored public configuration.

Leaders supports opt-in `allowPhaseSwitching` (default `false`). The renderer requests
allowed `phaseOptions` from the same provider; selection is local to that instance.
The API accepts `visitorPhaseId` separately from the base scope and validates it
against that base's groups and known team/phase membership **before** fetching
statistics. An effective phase constraint, explicit or inherited, is locked: no
selector is offered and visitor attempts to clear/change it fail. One relevant
phase also hides the selector. The active phase name appears in the header.

**Whole season** requests the original official `groupId` or `seasonId` table;
individual phases use the official skater `phaseIds` or goalie `phaseId` endpoint.
There is no summing of phase snapshots or averaging of GAA/SV%. The menu reflects
the existing imported-HMS directory, so phases without imported games are not
invented or offered. This is still a sporting catalog, not complete registration data.

Displayed rows now use sequential **1., 2., 3.** numbers. Internal `rank`/`tied` values
remain statistical ranks, and `data-stat-rank` retains them in the rendered list.

### Stars audit — 2026-11-11

The current public HMS client
`https://prod.hms.wootera.net/static/js/main.a97384ff.js` was inspected. Its
Infographics Star Leaders maps the `Stars` field from
`/admin/tablePlayersStats?phaseIds=...`, sorts only by descending `Stars`, and
therefore preserves API order for ties. V1's alphabetical tie-break could choose a
different TOP 5 at the same value. The shared metric definition now specifies
`tieBreak: 'sourceOrder'` for Stars; all consumers of `rankLeaders` share that rule.
No new Stars calculation was introduced.

`node scripts/check-widget-stars.mjs` compares current public PHM season records
with the same season's combined phase IDs, matching **player + team**, not names.
The audit found **zero Stars value mismatches**. Radek Postupa, Jan Pravda and
Eduard Synák each have 3 on their relevant records. Dominik Bláha has distinct team
stints with 2 and 3; Radek also has zero-Star records for other teams. These records
are kept separate, as in V1. The administrative Infographics response itself needs
its own HMS login; this audit verifies its public source code and public sporting
tables, not a captured authenticated admin response or unavailable screenshot scope.

Widgets use the existing Site Builder draft/publication store. There is no new
database table or independent publication workflow. The `widgets` array stores
ordered instances, each with its own `widgetInstanceId`, `widgetType`, `enabled`,
`placement`, `scope`, metric/limit, and display options. Disabled widgets remain
editable. An explicit empty array removes every widget. Old portal configurations
without `widgets` migrate their homepage Insights carousel to a registry instance
when the Insights section is enabled; no automatic database write is performed.

## Builder and public routes

Use **Widgets → Add Widget** in `/control/apps/public-portal?org=phm`. The searchable,
category-filtered picker reads the shared registry. Add Leaders repeatedly, select
Skaters/Goalies, one metric, TOP 5/10, placement, display mode and optional scope
overrides. Instances can be disabled, removed and reordered. Save, protected preview,
publication, revision conflicts and production/preview isolation retain the existing
portal behavior. Each instance provides a standalone link and iframe code.

Public homepage/competition placements use the selected season and competition.
The existing competition-system page links to group and phase contexts using
`section=system&groupId=<uuid>&phaseId=<uuid>`. Group and phase placements inherit
these fields in both the public portal and saved-draft preview. Season navigation
clears the previous group/phase. Team Pages are not implemented; their future
renderer can already provide `teamId` in `pageContext` to the same mount function.

`/widgets/leaders/phm?seasonId=<uuid>&metric=goals&limit=10&displayMode=standard`
uses the same renderer and data provider as embedded instances. Existing
`/widgets/insights/phm` links remain valid. Both standalone pages allow embedding;
Site Builder retains its non-embeddable policy. `/api/widgets` reuses the existing
Vercel game-summary function and adds no serverless function.

## Shared modules

- `public/widgets/definitions.js`: registry, metric definitions, schema validation,
  instance defaults, legacy migration, context inheritance.
- `public/widgets/statistics.js`: official row projection and metric ranking. Used
  by Leaders, Broadcast's team leaders, and Team Comparison's player projection.
- `src/app/broadcast-league.js`: bounded, fixed-host official statistics transport,
  shared promise coalescing and 60-second cache. Broadcast, comparison, player cards
  and Leaders reuse the transport. Goalie GAA/SV% are official HMS values.
- `src/app/widgets.js`: organization/season ownership checks, directory/branding,
  scope selection and public data projection. No token or raw private record is
  sent to the browser. Catalog/directory lookups are cached and coalesced too.
- `public/widgets/renderers.js`: common mount API for embedded and standalone views,
  error/retry, loading, empty, branding, standard/compact/container-responsive layouts.
- `public/widgets/picker.js`: registry-driven catalog and ordered instance editor.
- `public/player-card.js`, `public/player-card.css`, `public/player-portrait.js`:
  extracted Game Report card/controller and its original initials/photo fallback.
  Both products use them; Leaders provides a scope-based loader instead of a game ID.

## Scope and statistics semantics

Precedence is **explicit widget config → page context → site defaults**. Missing or
empty fields inherit; explicit `null` clears an inherited constraint. The server
always retains the organization boundary and validates competition, season, group,
phase and team membership before fetching official statistics. The public model
uses `organisationId` and accepts `organizationId` as an input alias.

HMS statistics endpoints are seasonal. The portal and generated iframe links provide
the selected/default season explicitly. When a standalone/API caller supplies no
season, the provider uses the requested competition's first season in the existing
catalog (or its injected `defaultSeasonId`). It does not silently pool season totals
or average goalie rates across seasons. Explicit invalid scopes fail; they never
fall back to another organization or an unfiltered leaderboard.

Official HMS tables return player/team records, so transfers remain separate team
stints, including goalie ratios. Clicking a row loads the shared Player Card for
that exact team and scope. Rows without an available metric are omitted, not changed
to zero. The existing eligibility baseline is an actual appearance (`GP > 0`);
there is no new six-game/minute threshold. `eligibility` is reserved for future
competition-owned policies and rejects unimplemented rules.

Ranks use the selected metric value, including ties before applying the TOP limit.
Secondary ordering stabilizes equal rows without breaking ties. GAA is ascending,
the other eight metrics descending. A tied boundary does not expand the configured
row count. PIM uses the same renderer with a neutral presentation.

Directory ownership and branding reuse the portal's imported-game coverage. Teams,
groups and phases without imported games are not yet a complete registration
catalog. Optional image/branding failures never block sporting data.

To add a future widget, register its metadata/schema/scopes, supply a renderer in
the renderer map and, if needed, a scoped data adapter. The builder catalog itself
does not need another hardcoded item. Standings, schedules, Team Pages and other
future widget types are outside V1.

## Validation

Run `node --test` and `node scripts/check-widget-fonts.mjs`. The latter decodes the
existing WOFF2 files and verifies actual mappings for all 28 requested Czech
lowercase/uppercase glyphs. Both Barlow files contain weight 700; CSS declares that
weight and uses Segoe UI/Arial fallback.

For isolated browser QA: `node scripts/preview-widgets.mjs --serve`, then open
`http://127.0.0.1:3017/league/phm` or the local builder. The test-only access code is
`widget-preview`. This server uses in-memory drafts and synthetic sporting records;
it neither reads nor writes production data. Stop it after QA.
