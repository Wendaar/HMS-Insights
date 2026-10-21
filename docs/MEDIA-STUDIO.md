# HMS Media Studio — MVP 1.0 / Sprint 1

Entry point: `/studio`. This increment is additive; existing Game Center,
GameSummary, Příklepy, import and webhook URLs remain supported. It creates no
HMS writes, shared editor configuration or database migration. No login gate is
included, as explicitly requested for the internal prototype.

## Data path

`src/app/media-engine.js` is a trigger-neutral read service over the existing HMS
transport, normalizer, snapshot repository and GameSummary builder. Game Center
continues to consume the same snapshot/summary machinery. Future OBS consumers
can use this service without a `game.finished` notification. The existing
finished-game importer and Příklepy rules retain their FINISHED-only guard.
Studio may normalize unfinished sporting data with an explicit read-only option;
it never runs final-result achievement rules or persists that result.

- Games uses the existing `/games` adapter with `from`, `to`, `limit=20`, `skip`.
  Both returned organization IDs and calendar dates are checked before exposing
  a page. Oversized, foreign or out-of-range source responses fail closed.
- If no HMS token is available, Games reads only bounded imported DB snapshots.
- Insights reads the existing public feed projection joined to organization-scoped
  games, with a safe field projection. It never regenerates player/team achievements
  or streaks. Each page has deterministic SQL ordering and one lookahead row.
- Today/Yesterday/Tomorrow use Europe/Prague calendar dates. `-7 days` and `+7 days`
  exclude today. Past/Future browse consecutive 30-day windows, each paginated
  separately. Neither client nor service downloads an unbounded history.
- Selecting a game prefers an existing imported snapshot. Refresh fetches HMS
  server-to-server and replaces only the bounded, in-memory 30-second cache.
  Existing Příklepy remain sourced from storage. There is no write to HMS or DB.
  Repeated refreshes coalesce and have a 10-second per-game minimum interval;
  cache size is 200 games and concurrent distinct game reads are capped at 8 per
  process. These are instance-local protections, not a distributed rate limiter.
- `/api/studio` reuses the existing GameSummary Vercel function via `view=studio`;
  this does not increase the repository's serverless-function count. GET only,
  no-store, bounded paging and generic backend errors. Credentials stay server-side.

## Organization connections

PHM defaults to organization `BB669217-41EB-4162-8040-A73F49A43570`, already present
in the repository's real-game fixtures. Its existing `HMS_API_TOKEN` is reused.
A server-only `HMS_PHM_ORGANIZATION_ID` can override that identity.

For EUCHL, YHG and BNHLH, configure `HMS_<ORG>_ORGANIZATION_ID` and, when needed,
`HMS_<ORG>_API_TOKEN` through the hosting environment. A dedicated token overrides
the shared token. A missing mapping or a token returning a different organization
produces an unavailable state; it never silently substitutes PHM data. These
connections cannot be configured through a public Studio API. The four selectors
are implemented, but availability of real data depends on these connections.

Local editor preferences and uploaded raster assets are saved only under
`hms-studio:v1:<ORG>` in that browser. Storage limits are reported; an oversized
local asset may work for the session without being persisted. Nothing is shared
between users or written to organization configuration.

## Graphics and export

Final Score requires FINISHED and known result counters. End of Period uses
cumulative, source-period goals only when the existing timeline says
`matches-result`. In-progress periods require an explicit numeric `currentPeriod`
from the source; periods before it can be exported. No period duration or current
period is guessed from elapsed minutes. Unverified/absent history does not become
zero. Empty/scorless periods not represented by the source are not invented.

The template provider (`templates`) returns semantic title/score descriptors;
`renderGraphic` handles layout and `formats` handles output dimensions. Additional
providers for Hattrick, manually confirmed Stars and trustworthy Special Teams can
reuse existing facts, players and the timeline's Special Teams read model. The
Insights card already renders existing Příklepy with player/team media. Sprint 1
does not implement new star selection or new achievements/streak calculations.

Formats: 1080×1080 and 1080×1920 PNG. Add 4:5/16:9 to the format registry only with
corresponding layout verification. The editor offers fixed text/layout, base and
accent colors, light/dark overlay, raster upload or HTTPS background, and partner
prefix/logo. Available organization/group/phase/team/player images are used; missing
logos fall back to initials or organization text. Long labels shrink/truncate safely.
The source does not always provide organization/phase logos; they are not fabricated.

Five self-hosted fonts (Roboto, Roboto Condensed, Roboto Slab, Noto Sans, Noto Serif)
include Latin/Latin Extended, Cyrillic, Greek and Vietnamese subsets where supplied
by the font. Fontsource OFL licenses are included. Only required font subsets load;
fonts and images finish loading before the single canvas used for preview/export
is accepted. An unavailable required font/background/partner logo disables export
with an actionable error. Optional sporting images use a labeled fallback.

There is deliberately **no server image proxy**, so arbitrary image URLs cannot
trigger server-side requests/SSRF. The browser accepts public HTTPS URLs without
credentials, ports, IP literals or local hosts; CORS is required. PNG/JPEG/WebP
only, max 8 MB / 40 million decoded pixels; uploads downsample to max 1920 px.
SVG uploads are excluded. Use upload if a remote host blocks CORS. Async renders
and uploads reject stale results after organization/input changes. A completed PNG
is downloaded directly; Web Share with files is offered only where supported.

## Verification and known limits

- `pnpm test`: 126 passing tests (118 original + 8 Studio tests). Coverage includes
  Prague midnight/DST/year boundaries, every filter, bounded pages, organization
  mismatch, safe projection, SQL scope, read-only live normalization, period score
  availability, image URL validation and safe HTTP errors.
- `pnpm run build:static`: passed. The command builds the existing demonstration
  feed, not a Vercel deployment; regenerated unrelated demo files are excluded.
- `node scripts/studio-browser-check.mjs`: passed in headless Chromium, with mocked
  Studio API responses clearly labeled `browser-test-fixture`. Ten real PNG files
  were downloaded and their dimensions/signatures verified: 2 ratios × 5 fonts.
  Also checked period/Insights selection, actual CORS-enabled logo pixels, raster upload, failed CORS disabling
  export, a 390 px viewport without horizontal overflow, per-org preference
  isolation, and the existing local report/Příklepy routes. Playwright is an
  optional local test tool; set `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH` when supplied
  by a separate runtime. Test images go to `/tmp/hms-studio-browser` by default.
- Read-only GETs against the existing production GameSummary on 21 October 2026
  (Europe/Prague) confirmed the following; this is separate from browser mocks:

| Game ID | Actual response | Příklepy |
| --- | --- | --- |
| F6321894-98CA-11F1-8BDF-EF2495D048F3 | Hc Slavoj Zbraslav – HC Kosti, **5:10** | **4** |
| F6312E3A-98CA-11F1-8BDF-EF2495D048F3 | PUK PAK PIVO – HC Kosti, **9:3** | **10** |

The first game currently exposes periods 2:3, 2:4, 1:3; cumulative outputs are
2:3, 4:7, 5:10. The second currently has unknown timeline coverage, so only Final
Score is available. Historical expectation 9:3/10 for F6321894 is an ID mix-up.

This workspace has no Vercel environment credentials or direct production DB
connection. Authenticated HMS listing/refresh, actual EUCHL/YHG/BNHLH credentials,
source ordering stability/currentPeriod schema, serverless cache behavior and
real iOS/Android native sharing still require a credentialed preview/device check.
Browser API fixtures are not evidence that these integrations were exercised.
The real HMS `/games` endpoint must honor the existing date/paging contract;
Studio rejects incompatible responses rather than returning unbounded data.

Before public production rollout, **authentication and organization-based
authorization are mandatory**, including authorization for every data request,
authenticated configuration management and distributed rate limiting. The current
prototype intentionally serves public sporting read models without that gate.
Do not merge/deploy it as a secured multi-tenant admin application.

## Delivery

Review branch: `codex/media-studio-sprint-1`, targeting `main`. Repository write
access was restored after the GitHub App installation was completed. Changes
are published for pull-request review only; production is not merged or replaced.
