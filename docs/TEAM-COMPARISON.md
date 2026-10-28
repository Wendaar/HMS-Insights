# Team Comparison (Beta)

Management / output settings: `/control/apps/team-comparison?org=phm&lang=cs`.
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
  show 20, then 20 more. Null source is visibly unavailable, not zero.
- All these numbers cover the selected phase, **not a calendar month**.
- Form: shared imported FINISHED results, same organization, season, group and
  phase. All counts and goal totals must match the official team table. If the
  history is incomplete or stale, suppress form and show imported / expected.
  At most five recent games, chronological left to right.
- Indicative form index: win=3, draw=1, loss=0, divided by maximum for available
  recent games. This is an editorial index, not official points or a forecast.
- Attack / defense comparison uses goals for / against per game. Ties share a
  rank; zero-game teams are excluded. Discipline compares total penalty time.
- Starts threshold is optional, 1–200, and applies to this phase. It only counts
  players reaching the chosen GP threshold; it is not playoff eligibility.
- Old subjective team/goalie strength ratings are intentionally unavailable in
  this Beta rather than reusing PHM-specific weights or missing-data defaults.

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
