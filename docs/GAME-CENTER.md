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

Validation now includes 88 passing tests, symbolic mark stability and bounds, team clusters, SVG escaping/color validation, 5-on-5 defaults, token-free/scoped public stats requests, transfer aggregation, ranking, partial-data fallback, safe HTTP errors and the parameterized group/season/date query. Local visual checks used actual allowlisted stored goal details, including two known shot and target zones, and the real public HMS player summary (Mansur Ischoev: 7 GP, 6 G, 7 A, 13 P at the time of verification). No test event positions or stats are substituted into Vercel reports.
