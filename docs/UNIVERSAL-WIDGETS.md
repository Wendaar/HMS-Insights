# HMS Universal Widgets + Leaders V1

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
