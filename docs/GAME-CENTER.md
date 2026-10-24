# HMS Data Engine · Game Center MVP

The existing server-side pipeline is the first increment of the shared engine:

`HMS → normalizeHmsGame → analyzeHmsResponses → transactional normalized storage → GameSummary v1 → Game Report / media consumers`

Příklepy remain a derived product of the same normalized data and keep their existing rules, feed, archive and HMS links. Public Příklepy details now also link to the local Game Report. No second HMS integration or client-side token is introduced.

## Routes

- `/game-center/:gameId`: public server-rendered Czech Game Report.
- `/api/game-summary?gameId=:gameId`: public allowlisted JSON contract, `schemaVersion: 1`.
- Both return 400 for malformed IDs, 404 for games not yet imported, 405 for unsupported methods, and 503 for unavailable storage. Errors never include database exceptions. Successful responses use a 60-second shared cache with up to 300 seconds of stale revalidation.

The report includes the stored HMS result, competition context, ranked players, recorded goalie statistics, all Příklepy and an event timeline. It works for games with zero Příklepy, too. The contract deliberately omits raw responses, arbitrary facts, contact data and internal organization identifiers. It is intended to be public, like the existing feed; organization-specific access controls would need a separate authenticated contract.

`timeline` is an additive extension of GameSummary v1. It contains allowlisted goals (including named assists), penalties (including fractional minutes), saves, collection availability and score coverage. The report defaults to goals and penalties on a horizontal scrollable rail; a filter also exposes recorded saves. Clicking an event opens its details, with a shareable event hash. Team and period filters also update goal-map counts. `periodScores` uses only source-provided numeric/recognized period labels: boundaries and period durations are never inferred from minutes. Clock ordering follows the existing HMS adapter's elapsed `gameTime` convention; explicit periods take precedence if all goals have them, including for clocks resetting between periods. Unknown/tied goal clocks suppress running scores.

`coverage: "matches-result"` means goal counts and team attribution match the stored result, not that every sporting event was recorded. A score mismatch preserves the official final result and available events, while suppressing running/period scores. Prior imports without an event snapshot show an explicit unavailable-history message. Missing collections and explicitly empty collections are distinct; empty API event lists never fall back to stale embedded events.

## Import triggers and corrections

No `game.finished` event is necessary to read or build a summary. The existing authenticated manual import (`POST /api/admin/import-game`), backfill and `game.updated` webhook all use `processFinishedGame`. A correction replaces the full normalized snapshot and recomputes Příklepy. Replacement now runs in one Neon transaction, with a transaction-scoped advisory lock per game to serialize concurrent writers. Readers aggregate the game and its children in one SQL statement so they observe a single committed snapshot.

This increment still imports **finished games only**, as required by the existing normalizer and SQL constraint. The function name `processFinishedGame` describes that current constraint, not a mandatory event trigger. LIVE/scheduled games will need a separate synchronization path and explicit schema/status evolution before enabling new event types. Do not remove the guard and run final-result Příklepy rules on live scores.

## Existing imports and rollout

Migration `005_game_event_snapshot.sql` adds one nullable JSONB column to `games`. The Postgres import path checks the schema and adds the column only if missing, following the existing import-time upgrade pattern. The event snapshot, statistics and Příklepy are then replaced in the same transaction. Apply migration 005 manually for the legacy Supabase REST/SQL seed paths. No new environment variables are needed beyond existing configuration.

Public reads are backward compatible before migration because the reader uses `to_jsonb(g)`. Existing imported games remain readable without reimport; populating their history requires an authenticated reimport. The primary acceptance game is:

`/game-center/F6321894-98CA-11F1-8BDF-EF2495D048F3`

Read-only verification against the database and the public HMS log on 19 October 2026:

| Game ID | Stored match | Result | Příklepy |
| --- | --- | --- | --- |
| `F6321894-98CA-11F1-8BDF-EF2495D048F3` | Hc Slavoj Zbraslav – HC Kosti | 5:10 | 4 |
| `F6312E3A-98CA-11F1-8BDF-EF2495D048F3` | PUK PAK PIVO – HC Kosti | 9:3 | 10 |

The 5:10 game has 15 goals and 4 penalties in the public HMS event log. Its last goal is David Polomis at 42:17, assisted by Adam Patočka and Mansur Ischoev. Both existing result reports were verified on Vercel; a subsequent authenticated reimport was verified with 15 goals, 4 penalties, 46 saves and source periods 2:3, 2:4, 1:3. Preview: `https://hms-insights-git-codex-hms-game-center-wendaar.vercel.app`.

After deploying the new code, open `/admin/import-game` on that preview, enter the existing webhook secret directly in the password field, and import the prefilled 5:10 game. Expect 15 goals, 4 penalties and 4 Příklepy. Repeat the import and confirm counts and running scores are unchanged. Credentials must never be pasted into chat, URLs or source files. The form links to the updated Game Report on success.

Deploy the new writer before relying on persistent history: an older deployed writer still deletes/recreates game rows without the new snapshot, so an old webhook deployment can clear that history until the next new-code import. Use the same new deployment for manual imports and webhooks during rollout. Source revision ordering and periodic reconciliation remain future work.

The public report cannot fetch/import a missing game. It returns 404 until an authorized import has completed. Merge/deployment is a separate release decision; the existing HMS token and webhook-secret scopes were extended to Preview with explicit user authorization, without revealing or rotating their values. Production was not redeployed or merged.

## Data limits and next increments

- Score comes from the stored normalized HMS result, which prefers official scores over event counts. Player and goalie statistics come from recorded events and can be incomplete.
- Earlier imports did not persist event snapshots. `eventCoverage: "unknown"` and `timelineAvailable: false` make that explicit until reimport. New snapshots store override provenance. Do not calculate save percentages from incomplete goalie attribution.
- `provenance.updatedAt` is the import timestamp, not a guarantee of live freshness.
- Media Studio and future OBS graphics can consume GameSummary v1; those clients and live refresh are outside this increment. Next steps are schema support for live status and a trigger-neutral synchronization service with retry/reconciliation.

## Verification

Run `node --test` after installing dependencies. Tests cover the existing Příklepy suite, the reconstructed 5:10 public log (15 goals, 4 penalties, 46 saves, 4 Příklepy), all running scores, corrections/deletions, duplicate and conflicting event IDs, repeated snapshot replacement, unified API format, explicit empty lists, nullable schema upgrade, clock ambiguity, source periods, field allowlisting, safe HTTP failures and actual Neon driver batching with mocked transport. Transaction rollback/concurrency semantics still need a disposable Postgres database before making production fault-injection claims.

`node src/server.js` offers clearly labeled local test previews for both game IDs when `DATABASE_URL` is absent. The 5:10 fixture reconstructs public sporting facts, not an original API response: event IDs are synthetic, save timestamps and undisplayed periods remain unknown, and competition hierarchy reuses the existing sanitized context. No fixture is used for production imports or Vercel reports. Set `DATABASE_URL` to read stored data locally.

## Horizontal timeline, zones and strength

Goal snapshots now retain allowlisted shot type, goal type/subtype, shot-origin zone, net-target zone and the conceding goalie. Penalties retain type and reason. Recognized HMS labels map to the 15 rink and 9 net categories from the HMS editor. Bare IDs and unknown labels remain unmapped, counted separately as unknown; no coordinates or shooting percentages are inferred. Editing these fields in HMS requires another authenticated import to refresh stored data. Older snapshots remain readable.

During import only, an optional five-second request to the official public HMS embed endpoint supplements missing rulebook labels. It receives no integration Authorization header. Labels are copied only for unique matches by event kind, team, period and gameTime with matching final scores; conflicting reference IDs are rejected. Failure is non-fatal. Public reports still read stored GameSummary and never call HMS or write data. Raw public payloads are not stored.

Recorded HMS goal strength takes priority. A separate explicitly labelled estimate supports one active penalty of at most two minutes with complete, consistent elapsed clocks. A PP goal ends that minor; a SH goal does not. Same-second goal/penalty ordering, reset clocks, explicit non-minor penalty types, queued same-team penalties and unsupported durations disable estimation. Coincidental active penalties do not imply PP. This is not a complete manpower simulator: PP/PK opportunity totals and percentages are deliberately absent, and missing strength is not treated as even strength.

The browser module uses only the allowlisted embedded summary, no network requests. Text is inserted with textContent; embedded JSON escapes HTML delimiters. CSP allows same-origin scripts without inline executable JavaScript. The timeline supports arrows, touch scrolling, filters and native keyboard-accessible dialogs; maps filter corresponding goals and keep unknown locations outside the spatial cells.

## Recorded match statistics

PP/SH estimation also supports short penalties with missing type labels, using their duration (at most two minutes) as a disclosed minor-penalty assumption. Such goals retain source `penalty-model` and basis `duration-assumption`; known minors use basis `minor-penalty`. A recorded HMS goal type still wins. Existing snapshots can use this calculation without reimport.

Goalies expose shotsAgainst = saves + attributed goalsAgainst and savePercentage = saves / shotsAgainst * 100, rounded to two decimals in JSON and one in the Czech UI. The source is explicitly recorded events, not a guarantee of complete shot tracking. Zero shots or missing/invalid counts yield null, not 0% or 100%. Goalies with conceded goals but no saves are now retained on import. Empty-net/unattributed goals are never assigned to a goalie just to match the final score.

Faceoff wins and percentages for both teams are stored in the existing versioned snapshot, no schema change. Prefer HMS detail totals, then event-response totals, then score/team-matched optional public totals. Otherwise count distinct nondeleted GameEventFaceOffs by wonByTeamId (or known winning player/team relation). An unknown winner is counted separately and suppresses percentages. Missing collections remain unavailable; an explicit 0:0 returns no percentage. Old imports require reimport to populate faceoff totals. The public HMS counters for the acceptance game were verified on 20 October 2026 as home 25, away 19 (44 total; 56.8% and 43.2%); no individual faceoff events were exposed in its public list.

## Public report design and player cards

The report uses original code-native SVG: a cropped rink with the attacking zone, neutral zone and part of the defensive zone, plus separate home/away nets. Goal marks keep their source zone and use stable, deterministic positions within it; they are not measured coordinates. Marks identify the global goal ordinal, with per-team clusters when a crowded zone needs grouping (× is a goal count). Unknown locations appear as gray clickable goal markers alongside the diagram. Net panels group goals by the opposing scoring team and list the defending team's recorded goalies underneath, so missing conceding-goalie attribution is not fabricated. The event dialog shows miniature rink/net diagrams only when their corresponding zones are known and omits empty detail rows. The archive navigation link is removed. Team rosters render as two columns on wider screens and stack on narrow screens. Map marks and player names support click/keyboard access.

The manpower model now defaults an unlabelled goal to 5 on 5 only with a usable complete penalty collection, consistent score and ordered elapsed clocks and no active penalty. One active short penalty yields 5 on 4 / 4 on 5; matching active penalties have equal counts. These remain model assumptions (including no goalie pull), while explicit HMS labels always take priority. Unsupported or ambiguous penalty logs still do not produce a made-up strength. Existing stored snapshots can use these views without another import.

Clicking a scorer, assist, roster player or goalie opens a current competition card. `/api/player-card?gameId=...&playerId=...` is rewritten to the existing GameSummary function with `view=player-card`, retaining twelve serverless functions for the current Hobby project. The ordinary GameSummary contract remains unchanged. The handler validates UUIDs and requires the player to occur in the selected stored game. Server-side requests use the verified public HMS playersStats / goaliesStats endpoints scoped to the game's groupId (the season and group context shown in the card); no integration credential is sent. The card allowlists sporting aggregates only, caches public source rows for two minutes and labels its scope and update date. Scorer ranking uses points, then goals; tied rows share the same competition rank. Player rows across teams are summed by player ID. Goalies expose available appearances, saves, conceded goals, shutouts and W/D/L counters, with save percentage computed from saves and conceded goals. If public stats are unavailable, a read-only parameterized database query aggregates loaded finished games in the same season/group through the current Prague date and clearly labels the result as partial imported-game data. Game reports themselves remain stored snapshots; the player-card lookup is an on-demand read with no writes.

Validation now includes 89 passing tests, symbolic mark stability and bounds, team clusters, SVG escaping/color validation, 5-on-5 defaults, token-free/scoped public stats requests, transfer aggregation, ranking, partial-data fallback, safe HTTP errors and the parameterized group/season/date query. Local visual checks used actual allowlisted stored goal details, including two known shot and target zones, and the real public HMS player summary (Mansur Ischoev: 7 GP, 6 G, 7 A, 13 P at the time of verification). No test event positions or stats are substituted into Vercel reports.

### Team special-teams comparison

`timeline.specialTeams` adds per-team EV/PP/SH goals, PP opportunities, shorthanded phases, conceded PP goals and PP/PK percentages. These are whole-game totals, separate from timeline filters. Clicking a goal count opens the matching events. PP = PP goals / advantage phases; PK = 1 - conceded PP goals / shorthanded phases. Zero opportunities produce null percentages.

The conservative short-penalty model counts advantage transitions, including staggered opposing penalties separated by equal strength. Equal coincidental pairs create no advantage. PP goals end the minor, SH goals do not. Missing collections, inconsistent results, reset clocks, goal/penalty timestamp ties, queued same-team penalties, unsupported durations/types or contradictory HMS goal labels suppress denominators and percentages. Counts remain available from HMS goal labels. This is a model of recorded short penalties, not official competition-certified PP/PK totals.

Timeline periods use successively darker bands and explicit period labels. Player cards show a leader or Top 10 badge only for current HMS rankings in the selected competition group; rankings from the imported-game fallback do not earn league badges.

### Sporting visual identity and media

The editorial report combines a broadcast-style team-logo scoreboard, a light main column and a compact team-comparison sidebar. Scoring leaders are selected from the sorted game stats for each team and clearly described as scoring leaders, not official stars. Stored HMS portraits appear in leader panels, rosters, the timeline, goalie cards and player dialogs. Missing/broken images use initials. No fabricated photos or NHL imagery are used.

GameSummary exposes safe sporting image URLs from the two existing HMS S3 buckets only, preferring stored templates resolved to cropped_md. Credentials, query strings and arbitrary hosts are rejected; CSP permits those exact buckets, with no extra script/connect origins. Existing imported photos/logos need no reimport. New imports retain a validated Flickr album URL in event_snapshot.media; the report offers an external gallery link when present. Flickr photos are not automatically fetched or selected as covers in this increment.

### Permanent public match URLs

`/game-center/:gameId/public` serves the same read-only report for every imported game, without application login or a per-match access toggle. The original `/game-center/:gameId` remains compatible. Import confirmation and Příklepy feed links use the explicit public URL. Invalid IDs and absent imports still return 400 / 404. This route does not bypass Vercel Deployment Protection: the deployment/domain must independently allow anonymous access. Admin ingestion still requires its existing secret.

### Official stars, roster counts and current rank markers

`/api/game-summary?view=extras&gameId=...` reuses the existing function for optional read-only display metadata. It loads the stored game, then fixed public HMS game/gameMultimedia and group playersStats endpoints without credentials, with five-second timeouts and a bounded two-minute memory cache. No ingestion or database writes occur. Public game responses often omit gameId: match both teams, date and final score before accepting stars/lineups; conflicting explicit IDs are rejected. Responses expose only sporting fields, allowlisted media and ranks for game players.

All non-deleted GameStars are displayed in an accessible horizontal carousel above game scoring leaders, without a fixed star limit. Stats are from the imported game; a selected non-playing goalie can be displayed without fabricated zero stats. Lineup role counts include non-playing goalies. Current HMS group Top 10 / leader icons appear directly in the roster and leader cards. Missing metadata remains hidden and never becomes fabricated awards.

The hero uses stored competition-group and venue logos. Neon green goal markers match green G-column styling. Album and YouTube links sit outside the horizontal section navigation so mobile visitors can find them. YouTube URLs are normalized to a valid 11-character video ID on official YouTube hosts. Flickr album links come from the imported HMS field; public gameMultimedia supplies the YouTube URL but does not expose the original Flickr album URL. Album changes require reimport; stars, public lineup counts, ranks and YouTube refresh independently.

### Match jerseys and embedded broadcast

New imports retain `homeJerseyColor` / `awayJerseyColor` as allowlisted hex values in `event_snapshot.jerseyColors`. GameSummary exposes each team's nullable `jerseyColor`, separate from club identity colors. Explicit match jerseys always win, including white and even identical opposing jerseys. Unknown jerseys remain null; only fallback display colors may be adjusted when club colors are too similar. White goal markers use dark outlines/numbers, legend dots and comparison bars have visible borders. Existing imports need refresh to capture match jersey selection; the public HMS game endpoint does not expose those fields.

A valid optional YouTube URL now creates a small privacy-enhanced `youtube-nocookie.com` embed with no autoplay in the sidebar; narrow layouts place it above the report's main content. The iframe has a title, lazy loading, fullscreen support, an origin referrer and a normal YouTube fallback link. CSP allows frames only from the exact privacy-enhanced YouTube host. Missing videos stay hidden. A valid Flickr album uses a Photos here button; missing album URLs stay hidden.

### Incomplete game clocks and recording order

Event snapshots now retain a validated ISO `recordedAt` sporting timestamp, preferring HMS timestamp and then createdAt. When game-clock ordering is incomplete and all goal/penalty events have timestamps, the report sorts by source period and recording timestamp (or globally by timestamp if periods are incomplete). This is explicitly labelled as recording order, not certified play order. Missing game clocks remain null; no elapsed minutes are invented. Running score and inferred penalty intervals stay disabled for recording-based ordering. Known shot/net zones and period goal totals remain independent of missing clocks. Public rulebook enrichment can match uniquely timestamped events when the game clock is absent.

Incident F629DB36: public HMS had 19 goal/penalty records while the stored row updated 2026-10-20 23:00 UTC had no event snapshot. A reimport restored the events and locations; PR #1 was subsequently merged and deployed to production, including snapshot persistence for future imports. Missing clock values did not erase the events.

### Czech and English reports

Every public report supports `?lang=cs` and `?lang=en`. An explicit supported value takes precedence. EUCHL (including the full HMS competition name European Union College Hockey League) defaults to English; other competitions retain Czech. CZ / EN links preserve the current report, query and event fragment. No reimport or database migration is required.

The shared presentation dictionary localizes server output and explicitly rendered browser fragments: event and player dialogs, filtered maps, official stars, roster counts and rank badges. Dates and numeric values use the selected locale. HTML translation is limited to escaped text and accessibility attributes; scripts, JSON, URLs and data attributes are excluded. Team, player, competition and venue names are protected. Known HMS sporting labels and existing highlight sentence patterns are translated; unrecognized free text is retained. Stored data and the public JSON API remain language-neutral, and the existing Příklepy feed is unchanged.

Validation: 188 Node tests, including six localization regressions for language precedence, full-name EUCHL detection, English/Czech rendering, names and script/attribute safety, translated sporting labels and unchanged API data. Browser checks cover filters, event details, player statistics and language switching.

### Team shots versus individual goalie attribution

GameSummary team `shotsOnGoal` is derived from every opposing team's recorded save event plus the team's goals, independently of individual goalie rows. This includes quick saves without a player ID. `shotsSource` is `recorded-events`; incomplete collections, unknown save teams or a goal/result mismatch yield null rather than a partial count. Each team also exposes `unassignedSaves`.

At the user's request, when there is exactly one recorded goalie for the team, unassigned team saves are included in that goalie's match calculation. A stored roster containing another goalie blocks this inference even if only one has played. `statisticsBasis: single-goalie-team-saves`, `attributedSaves` and `inferredSaves` keep the assumption explicit; a compact translated note explains it. With multiple goalies, counts remain attributed only and percentages stay suppressed (`partial-recorded-events`). This affects the display/read model, not stored player records, season statistics or Příklepy rules.

Regression match 6c02df50 (Prague Guardians–Bratislava Capitals 2:8): HMS reports 35 home saves and 17 away saves, including nine away saves without a goalie. Team shots must be 19:43; summing individual goalie rows incorrectly produced 10:43. Existing rich snapshots already retain those nine events, so this correction applies on read without reimporting or changing Příklepy. Four additional tests cover the real counts, partial goalie statistics, incomplete evidence, explicit zero saves and multiple goalies.

### Shared player portraits and goalie identity

Matched public HMS lineups now supply an allowlisted `playerImages` map in the existing optional extras response. Stars can supplement the same map. All report portraits carry a player ID and are hydrated from that map: scoring leaders, timeline, rosters and goalies. Player dialogs receive the same portrait source. Only known match players are updated, and image hosts remain restricted to the existing HMS S3 buckets. Missing images keep initials; no replacement player photograph is invented. This works without reimporting and performs no database writes.

Each net has a separate goalie identity area above it, with a softly faded portrait and a clickable name. The photo remains in normal layout above the net rather than covering the goal markers. Validation: 197 tests, including shared portrait identity/safety, goalie fallback layout, single-goalie save completion, a second roster goalie and an independent seven-save case.

### Public season schedule

`/game-center?seasonId=UUID` is a public Czech/English schedule for a single HMS season; it does not need an organization selection or a credential. Supported query fields are `lang`, `filter`, `windowPage`, `offset`, `date`, `groupId`, `phaseId`, `teamId` and `q`. Share the complete URL to preserve a view. EUCHL defaults to English unless the URL explicitly selects Czech.

Today and Yesterday read one day. The ±7-day filters read seven calendar days. Past and Future move through seven-day windows with earlier/later controls, rather than downloading the entire season. A date picker jumps directly to an older season's date. Dates are calculated in Europe/Prague; HMS local times are displayed without timezone conversion. The UI renders at most 20 games per page and groups multiple days under date headings. Optional staff names and the Game Name field are compact and omitted when empty. Planned default 0:0 values are suppressed; known live/final scores are shown.

The existing GameSummary function dispatches `view=games`, also rewritten from `/api/games`, without adding a Vercel function. It uses only the fixed public HMS `/games?seasonId=...&startDate=...` endpoint and optional `/seasonTerms` labels, never an integration token. Each fixture must match its requested season and day. Day reads have a six-second timeout, a 4 MiB response cap, a 2,000-record cap, up to three concurrent day requests, bounded caching/deduplication and a shared upstream-429 cooldown. The complete period fails visibly on source failure instead of pretending to be empty.

A single parameterized database query checks report availability for only the 20 visible game IDs and the same season. Imported games link to their new public Game Report; other games link to the original public HMS detail. No schedule read imports or changes game snapshots, Příklepy or HMS. GameSummary now includes the public `seasonId` so reports can link back to their season schedule. The hub remains unchanged.

Validation: 206 tests. New coverage includes Prague/DST boundaries, bounded day requests/concurrency, 20-game pagination, filtering before slicing, cross-season/day rejection, multiple officials and field allowlisting, scheduled versus live/final zeroes, unavailable data/429 behavior, scoped SQL and report-to-schedule navigation. Local browser verification covers the actual EUCHL Today/Past/Future views and a 390px viewport without document overflow.

## HMS identity

Use the supplied `/hms-logo.png` rather than a typographic HMS wordmark. Keep this original asset unchanged; `/hms-brand.css` crops only its display margins in compact layouts. `hmsBrand()` from `public/hms-brand.js` is the shared server/browser markup helper. Static entry pages use the same classes and asset. Keep product labels separate from the image. Brand links point to https://www.heromanagementsystem.com/ in a new tab with `noopener noreferrer`.

Every entry page uses `/hms-favicon-32.png` (the supplied 32×32 PNG). Include `/hms-brand.css` after the page stylesheet. Keep competition, organization and team logos independent from the HMS product identity. Inline source references, player initials and data labels remain text.

Report navigation: company logo links to the HMS website; the separate product label is inert unless given an explicit same-origin Game Center route. Highlights resolve the stored organization UUID through the server-owned organization registry; unknown ownership hides the link rather than falling back to PHM. Insight subjects use stored player/team IDs, not names parsed from prose.

Report display extras optionally refresh current group/competition logos using the matching organization's server-side API configuration (read-only game request, 4-second timeout, no retry). Ownership, game and both teams must match before exposing allowlisted sporting image URLs. Cache TTL is 2 minutes; outages retain the stored logo, with a 30-second negative cache. No reimport is required for branding refresh.
