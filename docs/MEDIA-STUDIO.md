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
  a page. Thin list rows get real names from one bounded organization-scoped
  metadata query; unimported games use up to three concurrent detail reads within
  a 12-second deadline. Missing labels are explicit, never Domácí/Hosté. Oversized, foreign or out-of-range source responses fail closed.
- If no HMS token is available, Games reads only bounded imported DB snapshots.
- Insights has a dedicated past-game library, independent of Games date filters.
  It reads the existing feed with server-side search over player/team/achievement/
  match names, a type filter, organization scope, Prague-today cutoff, deterministic
  ordering, and one lookahead row per 20-item page. Czech/Slovak search folds common
  accents; SQL wildcards are escaped and values parameterized. No achievement or
  streak generator is duplicated. Cards show the subject, achievement, team and
  source fixture/result. Future Games filters do not apply to this library.
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
prefix/logo. Available organization/competition/group/phase/team/player images are used; missing
logos fall back to initials or organization text. Long labels shrink/truncate safely.
The source does not always provide organization/phase logos; they are not fabricated.

Five body/name choices are self-hosted: Barlow Condensed, Oswald, Roboto Condensed,
Noto Sans and Noto Serif. Anton and Permanent Marker supply the fixed sport/brush
headlines (brush is used for English labels only). Fontsource licenses are included;
Latin/Extended and other supplied language subsets load as needed. Only loaded
fonts/images are accepted for export. An unavailable required font/background/
partner or manually supplied portrait disables export with an actionable message.

Clean and Crazy are real renderer variants, with distinct typography, foreground
shadows, lighting and accent effects; neither invents athlete photos or events.
Existing player/team stats supply the performance badge. Portraits come from the
ID-matched game roster and fall back to that same subject's team, never the home
team. An unavailable subject stays explicit. Transparent uploaded cutouts retain
transparency and the full figure; ordinary headshots use a photo frame.

Semantic content is clipped to conservative social safe rectangles: square
`x=64,y=64,w=952,h=952`; story `x=96,y=220,w=864,h=1360`. Background effects bleed
to canvas edges. Optional preview guide lines are DOM-only and never exported.
These are generic protective margins, not a promise about every platform's UI.

A portrait override is session-local under org/game/player identity; it cannot
carry to another player. Competition/group logo overrides persist locally under
org/competition/group scope, with a reset to HMS option. The large partner plate
is separate from the competition/group brand row. None of these overrides writes
shared configuration or HMS.

HMS raster assets use a narrow same-origin bridge at `/api/studio-image`, reusing
the existing GameSummary serverless function. The actual public HMS S3 images
were verified to return HTTP 200 **without CORS headers**, which prevents direct
canvas export. The bridge accepts only the two existing HMS Amazon S3 hostnames,
HTTPS/default port, no credentials/query/fragment, and refuses all redirects. It
never forwards HMS credentials. The browser uses same-origin credentials for
this bridge so Vercel's authenticated preview can serve images; arbitrary remote
URLs still use credentials=omit. An 8-second deadline, streamed 8 MB limit, raster
magic-byte checks and 16 concurrent reads per instance bound requests. PNG/JPEG/
WebP only; arbitrary background/partner hosts cannot use this bridge.

Other remote images still require browser CORS and public HTTPS validation.
Raster uploads are bounded to 8 MB / 40 million decoded pixels and downsampled
to max 1920 px. SVG uploads are excluded. Async renders and uploads reject stale
results after organization/input changes. A completed PNG is downloaded directly;
Web Share with files is offered only where supported.

The revised poster layout uses a masthead, large team badges, dense result panel
and a separate image/portrait area; uploaded photos are used only when supplied.
Shared normalization preserves rich team media when event references omit it.
Older snapshots can obtain missing team media from the existing public endpoint
only when both team IDs and the match date agree; scores/stats are never changed
by this optional media lookup. Organization logos use identity-checked server-side
organization metadata when provided.

## Verification and known limits

- `pnpm test`: 139 passing tests (118 original + 21 Studio tests). Coverage includes
  Prague midnight/DST/year boundaries, every filter, bounded pages, organization
  mismatch, safe projection, SQL scope, read-only live normalization, period score
  availability, image URL validation and safe HTTP errors. Additional tests cover
  thin list enrichment, missing/foreign labels, fixture-scoped public media,
  preserving rich team logos, image-bridge SSRF/redirect/MIME/size protections,
  away-player identity/photo selection, per-org branding scope, safe rectangles,
  library search/type projection and competition/group/player media identity.
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
- `node scripts/studio-insights-browser.mjs`: passed. Four more PNGs (Clean/Crazy
  × square/story), search and contextual cards with no Games filters, an
  authenticated-preview cookie fixture, actual portrait/away-team pixel checks
  rejecting the wrong home logo, manual portrait isolation across two players,
  portrait reset, preview safe guides, and 390px layout. These use synthetic API
  fixtures and a synthetic cookie, not a claimed production login.
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

## Visual feedback verification

After user testing, real public HMS logos were fetched and used for local square
and story poster review with the captured 5:10 public summary. The actual
production S3 home-team image also passed the real server image bridge (HTTP 200,
84,116 bytes). This verifies public asset delivery, not credentialed HMS listing.
Studio's live list still needs a credentialed preview check; test coverage now
explicitly models the thin rows that previously produced placeholder team names.

## Public subject reference

Read-only public source checks on 21 October 2026 confirmed Matěj Kuracina
(`da0ba510-648c-11ef-8a7f-3b932af99033`) in game
`f6293ef1-98ca-11f1-8bdf-ef2495d048f3` belongs to Berkut Praha, the away team,
with 3 goals. The captured summary is HC Domynos Praha 1:7 Berkut Praha. His
actual profile PNG and the Berkut crest returned HTTP 200 and were used for local
visual review/export in both designs and ratios. No replacement portrait was
generated. This public-media check is distinct from authenticated HMS/DB tests.

The original wrong crest came from a renderer fallback to the home logo; missing
preview cookies could also block image fetches. Both paths now have browser
regression checks. Competition logos absent from source data use explicit name
fallback plus the scoped local override; source-provided hierarchy logos are
retained in snapshot branding and supplemented by identity-checked reads.

## Review iteration: archive and four styles

- PNG download/share names start with organization and match date, then output,
  player (when applicable), fixture, ratio and style, e.g.
  `PHM 2026-10-20 Final Score Domynos Berkut 1x1 Clean.png`. Unsafe filesystem
  characters are stripped; Czech names are preserved.
- Clean, Crazy, Artistic (gold light, serif headline and laurels) and Technical
  (grid, sharp frame and dramatic beam) share the same verified data and safe areas.
- Games exposes existing stored Příklepy alongside score/period templates.
  Official single-player Star of the Match cards reuse Game Report's
  `displayExtras` identity/lineup validation. No award is computed from points.
  Missing official stars or unavailable period history suppress those choices.
- Games requests through the calendar day after the chosen end date to tolerate
  exclusive HMS `to` semantics, then removes endpoint lookahead rows locally.
  Source offsets still advance by 20 rows, so filtering never changes pagination
  offsets or organization scope. Future filters remain useful for later previews;
  result graphics still require completed games or verified completed periods.
- Empty date ranges now display an explicit message rather than a blank list.

Verification: 142 Node tests and static build; browser checks cover four styles
in both PNG ratios for results and Insights (16 PNGs), archive names, period/official-star selection, all filter requests, portrait/team identity, org preferences and
390px controls using synthetic API responses. Live HMS Today and credentialed
preview database behavior require verification in the connected preview; local
checks do not establish the upstream service's actual date-boundary semantics.
