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

## Invitation design and WhatsApp editor

The current creator screen prioritizes Game Day graphics, match invitations and
WhatsApp; email contact/queue controls are deferred from this screen. The private
backend/test-only queue remains available for later integration.

The match invitation calls the **same `drawComparisonTeam` renderer** as Team
Compare. Official rank, points/games, score and goals per game are projected from
the existing comparison service, never recalculated in the editor. Date plus
localized weekday, face-off time and venue have a separate prominent masthead.
Source jerseys appear as illustrated shirts, with color-picker overrides scoped
to the currently selected match; missing source colors use an explicit unknown
shirt. Overrides never replace HMS values or carry into another fixture.

Clean, Crazy, Artistic, Technical and PHM Pantha reuse Studio typography, effects,
and atmospheres, with all five shared export ratios. Custom base/accent, background
URL and PNG/JPEG/WebP upload use the existing bounded image loader. A required
background failure disables export. Uploaded backgrounds are bounded to 8 MB /
40 million decoded pixels and resized to 1920px. Settings and CS/EN invitation
templates persist under `hms-studio:settings:v2:<ORG>:game-day` in localStorage;
uploaded backgrounds use Studio's existing IndexedDB asset store. Persistence is
per organization and browser, not a shared server configuration. Loading the
screen restores that saved style. Empty custom headings select MATCH DAY or
GAME DAY automatically. Story capacity adapts to the chosen aspect ratio.

The organization/language invitation template includes greeting, fixture, date,
weekday, time, venue, roster instructions, source link and organization sign-off.
Creators can edit the template, insert field tokens using labeled buttons, reset
it, and edit the final message separately. Only the final message accompanies
the current PNG. Sensitive contacts and access keys are not part of preferences.

The primary Share to WhatsApp button is enabled only after the current PNG has
finished rendering. It passes the prepared image and current editable text in one
native share payload, preserving the user click. Cancelling native sharing does
nothing else. When combined file/text sharing is unavailable, it downloads that
PNG and opens wa.me with text; the user selects their group and attaches the PNG.
wa.me never claims to have attached an image. Actual mobile target behavior still
needs device testing; mocked browser share APIs are not delivery verification.

HMS's shared brand stylesheet now defines one blue refresh/load action with a
refresh icon for the major editors. Game Day places it in its own top load bar;
Team Compare (including its Studio shadow root), All Stars, Studio and Broadcast
use the shared visual rule rather than burying loading among design options.

## Public pregame details, direct analysis links and venue media

Invitations use `/m/<org>/<gameId>` for a read-only pregame page and the existing
production `/team-comparison/<org>` URL with season, group, phase, left team, right
team and CS/EN already selected. The older `/m/<org>/<gameId>/analysis` redirect
remains supported. There is no external URL shortener or mutable link mapping. Missing
comparison scope suppresses the invitation's analysis link. Previously saved text
templates also receive the direct analysis link; manually edited final messages remain
under the creator's control.

In Vercel preview, the new pregame detail uses the server-owned VERCEL_BRANCH_URL
(or VERCEL_URL) host, since production may not have the new route yet. Only a
validated `*.vercel.app` host in preview mode is accepted; production stays on
app.phmcup.cz. Preview authentication still applies to shared detail links until
production rollout. Team Compare continues to use its existing production route.
HMS phase/organization `logoUrls.md` must not be overwritten by missing legacy
`logoUrl` fields after normalization.

Old `/game-center/<gameId>` HTML links can display public sporting pregame basics
before the result is imported. The established JSON GameSummary API still returns
404 for unimported games. This fallback projects only fixture labels/date/time and
approved logos; it does not invent scores or expose raw lineups/contact metadata.
The scoped `/m` page additionally uses existing Team Compare data when available.

Form badges call the shared Team Compare canvas badge renderer, including its
green W, orange D and red L colors. Venue logos appear beside the prominent venue
name; competition/group/phase logos and small source names appear above the team
cards. When no logo is provided, the name remains. Source venue photos form a
lower photographic band without replacing the creator's custom background.
Multi-venue Game Day sheets do not pretend one venue photo belongs to all venues.

`Venue.backgroundImageUrl` (also the explicit infographic variants) is retained
through normalization/snapshots and the read model. Public metadata enrichment is
checked against both teams, date and the venue name. Existing snapshots can get
missing branding from the organization-scoped detail read. Flickr photo-page URLs
are resolved through a fixed, credential-free oEmbed endpoint; only validated
static Flickr raster URLs are accepted from that response. The existing raster
bridge now also supports those narrow Flickr CDN paths, retains size/time/MIME
bounds and refuses redirects. Arbitrary external image URLs are not server-proxied.

A real read-only check of game F62C9A5E-98CA-11F1-8BDF-EF2495D048F3 on 30 October
2026 returned NOT PLAYED, 1 November and a Venue object with name/nick/short only.
It did not expose the venue logo or background. Rendering support is verified with
synthetic media; the actual SPM photo still depends on the authenticated HMS detail
providing that source field. No venue API endpoint or image URL is guessed.

The subsequently supplied **Průvodce HMS API**, reference pages 9–10, confirms
`GET /api/v1/venues` with optional comma-separated `ids` (maximum 500); no filter
returns the organization's venue catalog. Images use `logoUrls.sm` (64px) and
`logoUrls.md` (300px), with null for no uploaded image. The guide does not define
the infographic-background field, so its presence remains a live response check.

The Studio now reads this documented venue catalog server-side using the existing
organization token. It verifies `/organization` before reading Venues, validates
row ownership when supplied, bounds the catalog, and filters enrichment by exact
venue UUID. Catalog media fills missing match media only; it never replaces the
creator background or guesses a stadium from a similar name. Reads cache for one
minute and coalesce per organization/requested venue IDs. A venue-catalog failure
does not hide the fixture or its already available media.

In Game Day, expand **Údaje stadionu z HMS → Ověřit Venues**. The safe read-only
catalog lists venues and reports logo/background as available, empty, not exposed
or unsupported. Select SPM Aréna and use **Kopírovat výsledek ověření** if a source
field needs inspection. Only projected sporting media and field names are copied;
tokens and unrelated raw-record values are not exposed. No new key is needed.
The diagnostic GET is `/api/studio?catalog=venues&org=PHM`, reusing the existing
serverless function. Actual authorized production responses still need verification
from the signed-in preview; the local fixture tests do not establish that HMS
returns an SPM background field.

Verification after the catalog integration: 449 Node tests pass, including six
venue transport/projection/ownership/ID-join/read-model/API tests. The browser
check verifies venue selection, media-availability states and safe-copy behavior
with synthetic catalog responses, alongside the existing PNG/share checks.

Verification after this addition: 443 Node tests pass; browser checks cover the
pregame page, old HTML fallback, analysis redirect and actual preselected Team
Compare selectors, logo/photo rendering and green/red form pixels. Public links
use the canonical app.phmcup.cz host and become available there after rollout of
these routes; the branch preview contains them independently of a production merge.

## Prepared private reminder backend (email UI deferred)

Apply `db/migrations/008_game_day_reminders.sql` explicitly in the preview DB;
set `DATABASE_URL` and `HMS_<CODE>_REMINDER_SECRET` (at least 24 random characters)
server-side for each organization. This capability is independent of HMS API and
cron secrets. The prepared reminder API requires this capability as a Bearer header; the current
creator screen does not display email management or accept this key. No secret in URLs,
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

Prepared API flow for later email integration: authorize center/config/contacts,
queue a reviewed fixture, then process the test queue. Current creator UI focuses
on image/text exports and WhatsApp. Jobs deduplicate by
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

Local verification on 30 October 2026: all 435 Node tests passed, including 25
new Game Day/reminder/invitation checks. The static demo build passed in the first
increment; unrelated generated demo assets were excluded. The revised browser
check passes 15 match PNG style/ratio combinations plus final match/Game Day PNGs,
shared Team Compare cards, prominent date/time/venue, color-picker shirts,
organization-isolated design/template/background persistence, full-day filtering,
CS/EN, native image+text share payload and fallback, and 390px layout. The existing
Team Compare browser regression also passes after sharing its card renderer.
Browser data and share APIs are synthetic; actual devices/delivery remain unverified.

Preview deployment: https://hms-insights-git-codex-game-day-preview-reminder-wendaar.vercel.app/studio/phm?section=game-day

Read-only HTTP checks confirm Vercel Authentication protects this preview (302
to Vercel SSO for the page and APIs). A signed-in authorized Vercel user can view
it. No protection was changed and no credentialed source/DB verification is claimed.
Whole-day UI checks additionally cover a 24-fixture, two-page response, stadium
filtering across pages and previous/next Story controls. Source `imported-snapshot`
remains an imported-only view and does not establish a complete live HMS schedule.

## Confirmed editor field and Flickr photo context

The user supplied the actual HMS input element with id `igBgImageUrl` and the
photo URL `https://www.flickr.com/photos/153512269@N03/54170419316/in/dateposted/`.
The reader now recognizes `igBgImageUrl` in Venue records and normalizes that
Flickr dateposted context to its canonical photo URL. A real read-only request
resolved the supplied photo successfully to the Flickr raster CDN. No venue-to-photo
association is guessed or hardcoded.

The actual Venues diagnostic previously pasted for Kateřinky listed only location,
logoUrls, name, nick, short, venueId and web: no background field. An editor input
id is evidence of the editor's field, not proof that public API v1 exports it. If
that field remains absent, HMS must add it to the API projection; client support
alone cannot recover the stored value. Verification: all 450 Node tests passed,
including the supplied URL and field mapping, plus the successful live photo
resolution.
