# Team Comparison (Beta)

Management / graphic output: `/studio/phm?lang=cs&section=team-compare`.
Team Compare is an integral third Studio source beside Games and Insights, mounting
the same reusable editor module in a scoped component (not another iframe/app).
The old `/control/apps/team-comparison?org=phm&lang=cs` definition URL also works.
The public page keeps the organization fixed in its route and exposes competition/season,
division, phase and both team selectors. Export/share/embed controls and the Control
link remain hidden. Embed also hides the page header. A locked season is a fixed
competition/season label; division, phase and both team selectors remain interactive.

Public interactive view: `/team-comparison/phm?lang=cs` (also `euchl`).
Open public page, Copy public link and iframe use the same selected public output
scope on the production domain: whole organization (default), selected competition,
or selected season. Team pairs are never automatically pinned. Visitors select
division, phase and teams within that scope. Studio always retains the full
organization catalog; the public output scope does not filter its editor. Optional deep links and reload retain the selected scope/teams in the
address bar; existing selection URLs remain supported. Embed adds `embed=1`. No organization code is needed: this is read-only public sporting
data and this app cannot save, publish or change HMS records.

The original reference is https://www.phmcup.cz/porovnani-tymu/ . Its inline app
reads five Google Sheet tabs, fixes PHM 2025–2026 / regular season, assumes ten
starts for playoff core and combines several subjective strength formulas.
The old page is preserved. This implementation uses shared HMS readers and
server-verified organization/season/group/phase ownership, with no Sheet fallback.

## Data and scope

- Season catalogue: shared `controlContextCatalog`. Groups and phases use the
  organization-verified HMS hierarchy and shared live directory, so they are
  selectable before the first imported game. Official scoped standings provide
  the assigned teams, including zero-game teams. Imported scope is retained as
  a fallback for unavailable/legacy hierarchies; no organization-wide team list
  or cross-season history is substituted.
- Standings: official public HMS `standings?phaseId=…`. API order is retained as
  official rank, including teams with zero games. No local standings tiebreaks.
- Player / goalie lists: `playersStats?phaseIds=…` and `goaliesStats?phaseIds=…`.
  Players are kept separate by team, even when they transferred. Lists initially
  show the top four offensive players. Verified defenders have a separate top-four
  list; no positions are inferred from points. Goalie lists remain separate.
  A neutral avatar reserves the same space for missing or failed images.
  Null source is visibly unavailable, not zero.
- If a statistics table is temporarily unavailable but phase membership has been
  verified, selectors retain only that phase's assigned teams and unknown rank,
  games, points and results remain null/dashes. Official zeros stay zero. Form,
  per-game ratings and history-dependent metrics stay unavailable before games
  or without enough verified history. No forecasts are generated.
- All these numbers cover the selected phase, **not a calendar month**.
- Form: shared imported FINISHED results, same organization, season, group and
  phase. All counts and goal totals must match the official team table. If the
  history is incomplete or stale, suppress form and show imported / expected.
  At most five recent games, chronological left to right.
- Indicative form index: win=3, draw=1, loss=0, divided by maximum for available
  recent games. This is an editorial index, not official points or a forecast.
- Attack / defense comparison uses goals for / against per game. Ties share a
  rank; zero-game teams are excluded. Discipline compares penalty minutes per game (lower is better).
  The total penalty time is also retained separately.
- Starts threshold is optional, 1–200, and applies to this phase. It only counts
  players reaching the chosen GP threshold; it is not playoff eligibility.
- HMS Star rating v1 (0–100) is editorial gamification within the same phase:
  40% points/game percentile + 20% offense percentile + 20% defense percentile
  + 20% recent form index. Percentiles use all active teams, ties get the midpoint;
  missing components disable the overall rating instead of reweighting. Fewer than
  five games is marked provisional. It is not official rank or a win probability.
  The goalie meter is actual pooled saves/(saves+GA), not a guessed strength score.
- PP/PK totals use `teamSpecialTeams` in the shared `team-performance` domain:
  the same conservative `buildGameTimeline` / game-report penalty model, also
  shared with Broadcast history. Sum opportunities/goals across all games, never
  average game percentages. Incomplete history or unsupported event clocks/penalties
  suppresses the full-phase percentage and shows coverage. No opportunities => null.
- Roster trends use stored full lineup snapshots, excluding `isGoalie=true`, or
  legacy normalized `player_game_stats` starts (which include scoreless skaters).
  This measures recorded lineup presence, not on-ice minutes. Each bar includes
  count, result, score and date; both teams use the same vertical scale, up to the
  last 20 games. Unknown lineups stay unknown. Average shows available lineup
  coverage; total engaged players use official GP>0, separating skaters/goalies.
- Stability is mean Sørensen–Dice similarity of consecutive known skater lineups:
  200*intersection/(sizeA+sizeB). Two lineups of ten sharing two skaters => 20%.
  Missing lineups break adjacency; show valid pairs / all possible pairs. No
  quality judgement or strength bonus follows from stability.
- Head-to-head lists imported finished results from the entire selected season,
  including other phases, restricted to the selected division's verified teams.
  It is explicitly an imported history and may be incomplete. Historical seasons
  are not merged automatically.

## Graphics and safety

Five shared Studio styles and heading fonts; PHM defaults Pantha/Hitch, others
Clean/Barlow. Two compositions (statistics/form), five formats including 1920×1080.
Logo loads reuse the allowlisted Studio image bridge; unavailable logos are
reported and do not prevent output. Font fallback preserves Czech names.

GET-only API `/api/team-comparison` reuses the existing game-summary function,
keeping the function count unchanged. Public embed permits frames; control does
not. Queries use bound SQL parameters and unknown organizations never fall back
to PHM. Public API reads have 5-second timeouts, 4 MB limits; results use a bounded
60-second cache. History / scope limits fail closed. No secrets, contacts or
unnecessary raw event data are sent to clients.

Verification: `node --test`; `node scripts/team-comparison-browser.mjs` with
`PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` pointing to local runtimes. Browser QA
uses explicit synthetic test data and never publishes records.

## Presentation and public output

Result badges and W/D/L counters share vivid green/red/orange colors; score
differences use green for positive and red for negative. PIM boxes use subdued
red. Recent form sits beside the club abbreviation. Goalies sort by known save
percentage descending, with unknown values last.

Long methodology and coverage copy is available beside its metric through a
question button (native hover description plus a keyboard/touch modal). Chart
opponent marks use verified club logos; hover, click or keyboard activation
reveals date, venue, score and lineup count. Missing venue/logo stays explicit or
uses a neutral fallback. Meetings also display both verified team logos.

In the editor, the production public link uses the selected public output scope. **Open public page** opens that clean output directly; **Copy public
link** copies it, and the embed code uses the same configuration. Public links do
not depend on a successful PNG/font/image render. These controls remain absent
from the rendered public page and embed.

## Public selection, aligned sections and badges (2026-10-29)

The deferred feedback from 2026-10-28 is implemented:

- `/team-comparison/phm` and `/team-comparison/euchl` work without season/team IDs.
  Public visitors choose named seasons, divisions, phases and two teams. The
  verified shared catalogue still contains imported HMS seasons and phases;
  unconnected organizations never fall back to PHM. Parent-scope changes clear
  dependent choices, controls wait for current requests, and stale responses
  cannot replace a newer selection. Old deep links still work.
- Both cards share seven desktop rows using CSS subgrid: overview, offense,
  defense, goalies, PP/PK, roster and rating. Different list lengths cannot offset
  PP/PK or subsequent section starts. Mobile cards flow naturally in one column.
- Game Report and comparison now share `pointRanks` (points, then goals; tied
  values share rank and subsequent places are skipped). Comparison point badges
  aggregate the player's team stints inside the selected division/phase. Missing
  offensive values suppress that table's badges. Top ten points and nonzero
  scoring/goal/assist leaders are shown for players with at least one start.
- Goalie top-five GAA and save-percentage badges rank the HMS player/team records
  with at least one start and a known metric. GAA sorts ascending, save percentage
  descending; ties share rank. GAA is not pooled across transfers without ice
  time. Badge details identify the season/division/phase, the record population,
  and qualification. These are calculated sporting badges, not official awards
  or cross-division/cross-season rankings.

## Public URL scope (2026-11-18)

Existing routes and preselection links remain supported. The shared Team Compare
module is used by Studio, the legacy editor, public page and iframe.

| Parameter | Contract |
| --- | --- |
| competitionId=UUID | Only seasons belonging to this competition in the route organization. |
| seasonId=UUID | Preselection; season switching remains available within the allowed competition unless locked. |
| lockSeason=1 | Requires seasonId; the public catalog contains exactly this season. |
| embed=1 | Presentation only; never adds a data restriction. |
| groupId, phaseId, left, right | Optional preselection within the verified allowed scope. |

Studio output scopes: organization adds no restriction; competition adds
competitionId; season adds competitionId, seasonId and lockSeason=1. Both public
link and iframe use the same scope, without copying the editor's team pair.
Studio stores publicRange and the selected season/division/phase in its URL for
reloads and language changes. Changing organization clears this state. Public
selection URLs retain competitionId and lockSeason across selection, language and
reload changes. No automatic “current season” resolution is used.

The server validates organization → competition → season before scope reads and
comparison cache access. Both imported metadata and the verified live HMS catalog
retain competitionId. Groups/phases are checked against their season on both live
and imported paths. Catalog, scope and compare reject malformed/foreign IDs,
competition/season conflicts and a lock without a season with HTTP 400 and a
localized scope error, rather than choosing replacement data. Compare cache keys
include competition and lock; warm hits still validate scope and team preselection.
Unavailable upstream data returns an unavailable state/503; a valid empty season
stays selected and displays an empty state. These URL constraints describe a public
view, not an authorization boundary for otherwise public sporting data.

Verified on 2026-11-18 against the public organization catalog and
https://public.heromanagementsystem.com/api/portal?org=phm&action=public:
PHM Cup competitionId=c7c0bb15-5d29-415d-851e-5d777c6cc621;
2026–2027 seasonId=e6134160-47cf-11f1-a223-bfdfbdd3a64b.
After deploying this change, the fixed public URL is:

https://app.phmcup.cz/team-comparison/phm?competitionId=c7c0bb15-5d29-415d-851e-5d777c6cc621&seasonId=e6134160-47cf-11f1-a223-bfdfbdd3a64b&lockSeason=1&lang=cs

~~~html
<iframe src="https://app.phmcup.cz/team-comparison/phm?competitionId=c7c0bb15-5d29-415d-851e-5d777c6cc621&amp;seasonId=e6134160-47cf-11f1-a223-bfdfbdd3a64b&amp;lockSeason=1&amp;lang=cs&amp;embed=1" title="Porovnání týmů – PHM Cup 2026–2027" width="100%" height="1000" loading="lazy" style="border:0"></iframe>
~~~

Regression checks: node --test (including team-comparison-scope.test.js) and
scripts/team-comparison-browser.mjs cover legacy links, all three export scopes,
locked public selectors, division/language/reload persistence, Studio full catalog
and organization reset, API validation, empty seasons and warm-cache rejection.
No production deployment is included in this change. Game Center, its routes and
iframe, statistical calculations and other widget implementations are unchanged.
