# Team Comparison (Beta)

Management / graphic output: `/studio/phm?lang=cs&section=team-compare`.
Team Compare is an integral third Studio source beside Games and Insights, mounting
the same reusable editor module in a scoped component (not another iframe/app).
The old `/control/apps/team-comparison?org=phm&lang=cs` definition URL also works.
The public page hides organization/scope controls, all export/share/embed controls
and the Control link; its two team selectors remain interactive. Embed also hides
the page header.

Public interactive view: `/team-comparison/phm?lang=cs` (also `euchl`).
The Share button produces a production-domain link retaining the season, division,
phase, two teams, language, optional starts threshold and graphic settings. Embed
adds `embed=1`. No organization code is needed: this is read-only public sporting
data and this app cannot save, publish or change HMS records.

The original reference is https://www.phmcup.cz/porovnani-tymu/ . Its inline app
reads five Google Sheet tabs, fixes PHM 2025–2026 / regular season, assumes ten
starts for playoff core and combines several subjective strength formulas.
The old page is preserved. This implementation uses shared HMS readers and
server-verified organization/season/group/phase ownership, with no Sheet fallback.

## Data and scope

- Season catalogue: shared `controlContextCatalog`; groups and phases currently
  require at least one imported game in that season. This is not a complete API
  season directory. An unimported phase will not appear yet.
- Standings: official public HMS `standings?phaseId=…`. API order is retained as
  official rank, including teams with zero games. No local standings tiebreaks.
- Player / goalie lists: `playersStats?phaseIds=…` and `goaliesStats?phaseIds=…`.
  Players are kept separate by team, even when they transferred. Lists initially
  show the top four offensive players. Verified defenders have a separate top-four
  list; no positions are inferred from points. Goalie lists remain separate.
  A neutral avatar reserves the same space for missing or failed images.
  Null source is visibly unavailable, not zero.
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
