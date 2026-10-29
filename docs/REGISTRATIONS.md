# PHM Cup registration control 2026/27 — CSV workflow

Internal entry: /control/apps/registrations in Map of Applications.
Manager entry: /registrations/team#<random-key>. No public team directory.
Source: manually uploaded HMS CSV, not live registration API data.
E-mail is deliberately ignored, even if present in a later file.

## Updating data

1. Export Season Player Registrations / All from HMS, without filters.
2. Unlock internal management using the configured organization code.
3. Select CSV and click Zkontrolovat soubor. Review counts, missing values,
   excluded seasons and registrations that would disappear compared with the
   existing snapshot. The preview does not save anything.
4. Multiple teams are automatic: one registration appears in every recognized
   current-season team from its Teams cell. The preview counts registrations,
   multi-team players and memberships separately. Blank/dash team rows require no
   manual action. Only genuinely unknown names open the optional exception review.
5. Confirm the file is a complete All export and click Nahradit uložená data.
   The supplied file requires no manual assignments or exclusion checkbox.

Successful import atomically replaces the current snapshot. Invalid CSV, empty
scope, no assigned players or a concurrent admin update preserves existing data.
Revision checks prevent stale overwrites. All/no-filter completeness cannot be
proven from this export; the administrator must verify it and inspect removals.

Team links remain unchanged on imports. The view shows the server upload time and
updates on the next load/refresh, not by push. To assign additional players later,
upload the same full CSV again. Previous manual assignments persist only when the
registration ID, player ID and original team text still match.

## What the supplied export contains

Read-only inspection of the supplied 29 October 2026 file found 2,231 rows:
1,220 PHM Cup / 2026-2027 and 1,011 excluded rows from other scope.
E-mail is absent. Payment Status, Payment Method and Registration Status are empty
in every row; Accepted by Player is populated. No real contact data is committed.

The independently checked season directory returned 61 current teams and the
organization's HMS catalog returned 197 known team names. All 1,214 registrations
with named teams resolve automatically: 442 have multiple current teams, yielding
1,937 memberships across all 61 teams. Six registrations have only a dash as their
team and are excluded from team views without requiring manual action. The earlier
660/560 split incorrectly assumed one team per player; it is superseded.

The user explicitly confirmed that each player belongs to ALL teams in Teams.
The parser consumes complete known names, longest first, including the historical
dictionary to prevent an embedded current name from matching an unrelated longer
team name. Whitespace/case differences are normalized, duplicate memberships are
collapsed, and only current-season team UUIDs are output targets. Unknown fragments
never authorize a guessed membership. Former single-team saved mappings do not
suppress newly recognized automatic multi-team membership.

This is a registration list, not an authoritative ACTIVE/INVITED roster. Current
membership and actual season invitation/date are unavailable in this export.
Created At is never called an invitation date. Empty payment/confirmation means
unknown, not NO or unpaid. The summary separately counts unknown payments.
CASH means manager payment, not proof of payment. The tool never changes HMS.

## Parser, identities and portraits

Required fields: ID (registration UUID), Player, Teams, Competition, Season,
Accepted by Player and either Player ID or Player Link. The latter must be the
exact HTTPS HMS /org/phm/players/<UUID> form. Competition/season labels match
PHM Cup / 2026-2027 exactly. Existing scoped DB metadata validates the fixed season
and competition UUIDs before loading canonical team UUIDs/names. Links bind UUIDs.

Supports UTF-8 BOM, semicolon/comma, quoted multiline cells and escaped quotes.
The real export's repeated Created At header is permitted; other duplicate
headers, inconsistent row widths, bad/duplicate registration IDs, duplicate
player/team identities, unknown payment enums and empty target scope fail.
Limits: 2 MB CSV, 20,000 rows, 50 columns, 4 MB JSON request body.

Photos come from existing imported HMS player/goalie records using exact
organization, season, team and player UUIDs. Only allowed HMS S3 URLs are used.
Missing photos show initials; media failure never changes registration data.
No photo is guessed from a name or filename pattern.

## Hosting and privacy

Uses existing DATABASE_URL and the existing signed admin session pattern.
Admin-secret precedence: HMS_PHM_REGISTRATIONS_ADMIN_SECRET,
HMS_PHM_TOOLS_ADMIN_SECRET, HMS_PHM_OPERATIONS_SECRET,
HMS_PHM_WEBHOOK_SECRET / HMS_WEBHOOK_SECRET. No password literal is in the frontend.

Tables initialize on demand. Production uses hms_registration_links,
hms_registration_rate and hms_registration_snapshots. Preview/local use separate
_preview tables. Preview uploads/links/revocation cannot alter production tool
state. Sporting directory/photos are read-only shared data. The DB role needs
CREATE TABLE and read/write access to these tables. No memory-only production
fallback exists. A preview upload does not populate production: upload the full
export once in the environment being used.

Raw CSV is not retained. One normalized snapshot stores assigned names, player
UUIDs, registration values, mapping hashes, registration IDs and import summary.
It excludes e-mail, arbitrary columns, browser credentials and pending player
details. Superseded snapshots are replaced; provider backups follow host retention.

Admin upload/preview/publish/mapping requires authentication and same-origin
mutations. Admin login creates an 8-hour Secure/HttpOnly/SameSite=Strict session.
Team links contain 32 random bytes in a fragment; browser removes it and
exchanges it in an Authorization header for an HttpOnly cookie. Only SHA-256
digests are stored. One active link per organization/competition/season/team.
Expiry (1 September 2027) and revocation are checked on every manager read;
replacement invalidates prior cookies. Manager tokens cannot access admin routes,
and scope/team overrides are rejected. Revocation works without source data.

Bearer links are transferable. Recipients can view the assigned team's names,
photos and registration/payment status until revocation/expiry. Links do not
identify readers and cannot recall displayed data/screenshots. Share only with
the appointed manager privately, revoke on departure/forwarding, and use Zamknout
on shared devices. No links are automatically sent to anyone.

Private no-store/no-referrer/noindex responses, strict CSP, blocked framing,
parameterized SQL and durable login/exchange/read limits are retained. No external
analytics or source HTML rendering. Hosting/APM must redact Authorization, Cookie,
Set-Cookie and disable body capture on these routes: upload bodies contain names
and rotate responses contain credentials. Code never logs raw CSV, payloads,
contacts, credentials or SQL/source errors.

## Verification

node --test covers CSV parsing, exact scope/IDs, missing values, ambiguous
matching, binding-aware mappings, read-only preview, complete-export acknowledgement,
stale revisions, failed-import preservation, team-only output, isolated snapshot
CAS SQL, scoped portraits and original auth/CSRF/IDOR/link lifecycle behavior.
The provided file was validated read-only against the 61-team public directory.
Browser QA uses fictional data and exercised login, upload, preview, manual
assignment, replacement and the resulting unknown-payment view.
The original 402 tests passed. A preview-build smoke test additionally verified the actual
61-team directory, private snapshot/link table access, authorized import preview
(HTTP 200, one synthetic row assigned) and the scoped portrait SQL. It did not
publish a snapshot or create any team links. The temporary build check is removed
from the delivered source.

Earlier live API check: existing HMS integration token returned HTTP 200 from
public-api.prod.hms.wootera.net/api/v1/organization but HTTP 403 from the exact
administrative SeasonPlayerRegistration request, also 403 without credentials.
User browser evidence separately confirms Player.email when requested.
Expired Vercel login was renewed normally. Temporary runtime/build probes and
their deployments were removed. CSV mode does not require that administrative
API; the previous opt-in canonical API adapter remains unused by default.
