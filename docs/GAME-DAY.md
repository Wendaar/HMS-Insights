# Game Day Preview & Reminder

Open `/studio/phm?section=game-day` (or another configured Studio organization).
The module is mounted in Media Studio, uses its organization/language selectors,
shared HMS media reader, GameSummary jerseys, Team Compare analytics and image
bridge, and appears in the Control Center registry and application map.

## Outputs

- Game Day: exact Prague calendar date; the browser assembles bounded 20-fixture
  API pages before enabling export, up to 100 fixtures plus an optional empty
  lookahead page. Competition/venue filters include the complete loaded day.
  Overflow, duplicate, foreign or mixed-source pages disable export instead of
  silently showing an incomplete schedule. Today/Tomorrow and day navigation.
  Stories 1080×1920, one column or two venue columns, six games per column;
  a numbered slide selector and previous/next Story buttons. All filtered fixtures have a slide, including venues
  with more than six games. Empty slides cannot be downloaded.
- Match Preview: selected fixture, source jerseys with optional local overrides,
  official standing, form, attack/defense per game, phase rating, average roster
  attendance and offensive leaders from the existing Team Compare service.
  Incomplete histories retain that service's unknown/coverage rules. Statistics
  unavailable from a source are explicit. Finished matches never use current
  standings as historical pregame facts. Source links and both text and PNG export.
- WhatsApp: native file sharing when supported, otherwise `wa.me` text share;
  manual group selection and send confirmation. Copy text and download PNG are
  explicit fallbacks. No group enumeration or automatic WhatsApp delivery.

## Private Reminder Center

Apply `db/migrations/008_game_day_reminders.sql` explicitly in the preview DB;
set `DATABASE_URL` and `HMS_<CODE>_REMINDER_SECRET` (at least 24 random characters)
server-side for each organization. This capability is independent of HMS API and
cron secrets. Enter it in Reminder Center's password field. It remains in memory
and clears on organization changes or leaving the module. No secret in URLs,
browser storage, public catalogs or logs. Settings, contacts, queue and attempts
are private; public day/match endpoints contain sporting data only.

CSV replaces the organization's contacts atomically. UTF-8, optional BOM, comma
or semicolon, quoted fields. Required header:

```csv
organisation_id,team_id,email,name
BB669217-41EB-4162-8040-A73F49A43570,22222222-2222-2222-2222-222222222222,manager@example.com,Example manager
```

Use real HMS organization/team UUIDs. Foreign organization IDs, malformed email,
duplicate team/email pairs and malformed CSV reject the whole import. Multiple
managers per team are supported. The `csvContactProvider` interface can be replaced
with an authenticated HMS provider without changing the queue or UI.

Configuration defaults to disabled. `enabled` enables manual test reminders;
`automatic` enables the scheduler; `language` is `cs` or `en`; `branding` contains
`title` and hex `accent`; `schedule.league` / `schedule.tournament` are hours before
kickoff, 0–168; `competitionTypes` maps competition UUIDs to `league`/`tournament`
(default league); `recipientTeamIds` restricts teams (empty means both fixture
teams). Configuration is scoped by organization UUID. Imports/settings never write
to HMS. Manual jersey overrides are frozen in each queued invitation and do not
modify shared HMS data.

Manual flow: load center, enable configuration, import contacts, select a fixture,
review graphic/text, queue reminder, simulate delivery. Jobs deduplicate by
organization/game/recipient/kind/mode. New recipients can be queued separately;
repeating a request cannot resend an existing job. Existing queued payloads are
frozen. Atomic `FOR UPDATE SKIP LOCKED` claims protect concurrent workers. Expired
five-minute worker leases can be reclaimed; completion checks the attempt number.
Retry delays are exponential (starting at two minutes), maximum three attempts;
failed jobs expose manual retry. Logs contain generic outcomes, never provider
errors/credentials. SQL tables enable RLS without public policies.

## Automatic scheduler and delivery boundary

`GET /api/cron/reminders` requires `CRON_SECRET` (minimum 16 characters); a daily
06:15 UTC trigger is registered in `vercel.json`, reusing the existing serverless
function. All organizations default to automatic=false, so rollout does nothing
until configured. It checks eight Prague calendar dates, at most 100 fixtures per
day, and queues only unstarted fixtures whose lead-time threshold is reached.
Prague DST conversion rejects nonexistent/ambiguous kickoff times. Unknown kickoff
times cannot be queued. Each organization reports failures independently. Repeated
runs are idempotent. The scheduler then processes up to 20 ready jobs per enabled
organization. Manual processing also works with automatic=false.

Daily cron is coarse: a three-hour tournament lead time can fall between runs.
For precise timing configure an authenticated external caller every 5–15 minutes
in a credentialed preview. Validate workload against the existing 60-second Vercel
function budget; large live schedules need a persistent worker and smaller cursor
batches before production. No claim of live scheduler or database verification is
made from local mocked tests.

Ecomail is an adapter boundary. Default test mode returns **simulated**, invokes no
network transport and cannot send email. The API rejects production mode and the
DB schema only accepts test jobs. An actual Ecomail transactional transport is
deliberately not included: endpoint, authentication, payload, idempotency behavior,
account entitlement and sender domain must first be verified. A later change plus
explicit production authorization is required. No production or test-address email
has been sent by this implementation.

## Extension and outstanding integration checks

The shared preview has `schemaVersion`, `kind` and `extensions.postGameReport`;
future post-game report jobs should have a separate kind and eligibility policy,
while reusing contacts, configuration, adapter and delivery log.

Required credentialed preview checks: apply migration, organization capability,
live scheduled HMS fixtures/hierarchy IDs and kickoff semantics, source jerseys,
Team Compare source coverage, actual DB competing workers and lease/retry behavior,
cron workload, and mobile native sharing. The current capability is an internal
organization admin key, not a complete user login/roles system. Production delivery
remains blocked pending verified Ecomail contract/configuration and explicit approval.

Validation commands: `node --test`, `node scripts/game-day-browser.mjs` (requires
Playwright and Chromium; supports PLAYWRIGHT_MODULE / CHROMIUM_PATH),
`node scripts/build-static.js`. Browser checks use synthetic sporting data and
never establish live HMS, DB, Ecomail or WhatsApp delivery.

Local verification on 30 October 2026: all 430 Node tests passed, including 20 new
Game Day/reminder tests; static demo build passed (unrelated generated demo files
excluded). Headless Chrome passed PNG signature/dimensions, complete Story page
partitioning, match stats/jersey override, private center, test queue, CS/EN,
WhatsApp text fallback, 390px layout and navigation/capability reset checks.

Preview deployment: https://hms-insights-git-codex-game-day-preview-reminder-wendaar.vercel.app/studio/phm?section=game-day

Read-only HTTP checks confirm Vercel Authentication protects this preview (302
to Vercel SSO for the page and APIs). A signed-in authorized Vercel user can view
it. No protection was changed and no credentialed source/DB verification is claimed.
Whole-day UI checks additionally cover a 24-fixture, two-page response, stadium
filtering across pages and previous/next Story controls. Source `imported-snapshot`
remains an imported-only view and does not establish a complete live HMS schedule.
