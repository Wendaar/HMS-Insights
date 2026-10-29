# PHM Cup registration control 2026/27

Internal entry: `/control/apps/registrations`, linked in Map of Applications under
Data & Admin and the infrastructure branch. Manager entry: `/registrations/team`.
The shell contains no team index or player data. All data and link management are
handled by `/api/registrations`, dispatched through the existing Vercel function.

## Current integration status — 29 October 2026

The UI, authorization, link lifecycle, normalization and tests are implemented.
**The existing integration token cannot access the administrative registration
endpoint (HTTP 403).** Do not describe this feature as production-ready or enable
the verification flag until an authorized registration reader is available.

The existing integration is `https://public-api.prod.hms.wootera.net/api/v1` and
uses an organization-scoped server token. The administrative page
`https://prod.hms.wootera.net/org/phm/seasonplayerregistrations` does not establish
that the public API token can read registrations. The initial hosting HTTP 403
was caused by an expired Vercel OAuth login; its normal refresh succeeded.
The HMS token is a Vercel sensitive environment variable and cannot be retrieved
through the configuration API. It was tested inside an isolated preview build,
without extracting it or logging any raw payload, credentials or contacts.

Verified server-side results on 29 October 2026:

- Existing token -> `GET https://public-api.prod.hms.wootera.net/api/v1/organization`:
  **HTTP 200**, organization metadata returned. The token itself is working.
- The same token -> `GET https://api.prod.hms.wootera.net/admin/entities` with
  `entity=SeasonPlayerRegistration` and the exact organization/relations/attribute
  selection supplied from the HMS browser request: **HTTP 403**.
- The same administrative request without a token: **HTTP 403**.

User-supplied browser evidence confirms the signed-in administrative endpoint
returns `Player.email` when explicitly requested, plus `isAccepted`, `isPaid`,
`isConfirmed`, `paymentMethod`, Player/Teams and Season/Competition. No real
contacts from screenshots are copied into this repository. This does not grant
the integration token the administrator's browser permissions. Do not copy HMS
browser cookies or personal login credentials into the service. The next upstream
requirement is an organization-scoped read permission for registrations, or an
equivalent official integration endpoint that exposes the required fields.

The administrative response also includes older seasons and other competitions;
organizationId alone is not the required PHM Cup/2026–27 filter. Pagination,
current team membership status and exact season invitation coverage remain
unverified. `createdAt` is not yet verified as a season invitation timestamp.

The implementation deliberately has no guessed live endpoint and no synthetic
production data. Without a verified reader it displays an explicit unavailable
message, never a zero-debt or zero-player result. Link revocation remains available
to admins during source outages.

## Server configuration

Uses the existing organization access pattern: password/code sent only in an
Authorization header, followed by an 8-hour signed Secure, HttpOnly, SameSite=Strict
cookie. No password is embedded in public assets or committed here. Resolve the
admin code from the existing configured value; precedence:

1. `HMS_PHM_REGISTRATIONS_ADMIN_SECRET`
2. `HMS_PHM_TOOLS_ADMIN_SECRET`
3. `HMS_PHM_OPERATIONS_SECRET`
4. `HMS_PHM_WEBHOOK_SECRET` / `HMS_WEBHOOK_SECRET`

Check which existing variable carries the established internal access code before
deployment. A configuration fallback does not prove that a particular password is
already configured. `DATABASE_URL` is required for durable links and rate limits;
the schema in `src/infrastructure/registration-links.js` is initialized on demand.
The database role needs CREATE TABLE plus SELECT/INSERT/UPDATE/DELETE on these
two tables. No in-memory production fallback exists.

Required upstream settings, only after verification:

- `HMS_PHM_REGISTRATIONS_URL`: HTTPS URL of an authorized reader implementing the
  contract below. This is server configuration, never a request parameter.
- `HMS_PHM_REGISTRATIONS_API_TOKEN`: dedicated server-side reader credential.
  Existing `HMS_PHM_API_TOKEN` / `HMS_API_TOKEN` can be reused only for the exact
  public-api HMS origin. Credentials are never forwarded on redirects.
- `HMS_PHM_REGISTRATIONS_VERIFIED=true`: explicit gate after real-data validation.

If HMS exposes a different schema, implement a server-side adapter from its
verified fields to this contract. Do not set the gate merely because a guessed
endpoint returns HTTP 200. Never reuse a person's HMS password/session or export
personal browser cookies to the app.

## Required reader contract (not a claim about existing HMS field names)

The server sends organizationId, competitionId, seasonId and optionally cursor.
Every JSON page must contain:

```json
{
  "schemaVersion": 1,
  "organizationId": "bb669217-41eb-4162-8040-a73f49a43570",
  "competitionId": "c7c0bb15-5d29-415d-851e-5d777c6cc621",
  "seasonId": "e6134160-47cf-11f1-a223-bfdfbdd3a64b",
  "complete": true,
  "nextCursor": null,
  "teams": [{
    "teamId": "11111111-1111-4111-8111-111111111111",
    "name": "Example team",
    "members": [{
      "playerId": "22222222-1111-4111-8111-111111111111",
      "name": "Example player",
      "email": "example@example.invalid",
      "photoUrl": null,
      "status": "ACTIVE",
      "invitations": [{"seasonId": "e6134160-47cf-11f1-a223-bfdfbdd3a64b", "sentAt": "2026-09-01T12:00:00Z"}],
      "registration": {
        "seasonId": "e6134160-47cf-11f1-a223-bfdfbdd3a64b",
        "acceptedByPlayer": true,
        "paymentMethod": "CASH",
        "paymentStatus": "UNPAID",
        "status": "WAITING"
      }
    }]
  }]
}
```

`complete:true` attests that each included member has complete invitation coverage
for this season and the correct current-season registration. The final page must
use `nextCursor:null`; a string requests another page. Teams can span pages;
membership identities must not repeat. All PHM Cup teams and their ACTIVE/INVITED
members must be enumerated across the pages; a successful empty partial list is
not acceptable. Verify the fixed season/competition IDs against authoritative HMS
metadata before enabling. The IDs come from the prior local portal metadata probe;
they are not independently reverified in this change.

ACTIVE members are shown even without an invitation/registration. INVITED members
require an invitation whose seasonId is the selected season, independent of its
calendar year. Old-season payments or invitations never establish current-season
acceptance/payment. Missing boolean/payment/status values remain unknown. Accepted
is strictly boolean; PAID/UNPAID and CONFIRMED are explicit normalized enums.
CASH is displayed as “Platí manažer” and never implies PAID. Latest invitation is
the maximum valid timestamp from that season. Unknown date is labeled unknown.
No inference is made about password setup, actual invoice issuance or why an
otherwise complete registration remains unconfirmed.

## Authorization and privacy

- Links contain 32 random bytes (256 bits) as a URL fragment. The browser removes
  the fragment immediately and exchanges it in an Authorization header for an
  8-hour Secure/HttpOnly/SameSite cookie. No token goes into URL query/path, access
  logs, analytics, localStorage or sessionStorage. Copy/share the original full
  fragment URL; the cleaned address bar is not a share link.
- DB stores SHA-256 digests only, bound to organization + competition + season +
  team UUID. One row per team/scope. Creation/replacement atomically replaces the
  digest; revocation and expiry are checked in DB for every manager data read.
  Existing browser cookies cannot bypass revocation. Links expire 1 September 2027.
- Team ID, org and season overrides are rejected on manager reads. Source data
  for other teams never leaves the server. Admin source validation is required
  before creating links. Revocation does not depend on upstream availability.
- Admin sessions alone never authorize a manager route. Manager tokens never
  authorize admin routes. The app only reads HMS; it does not change registration,
  acceptance, payment, invitations or eligibility.
- SQL is parameterized. Rate buckets are durable and keyed by an HMAC of action,
  server-observed IP and 10-minute window; 15 login/exchange attempts and 120 team
  reads per window. Vercel's platform x-real-ip is used only on Vercel; configure an
  equivalent trusted ingress before hosting elsewhere. No raw IP is stored.
- Responses and shells are private/no-store, no-referrer, noindex/nofollow/noarchive,
  with strict CSP and blocked framing. No external scripts or analytics. Photo
  URLs are restricted to existing HMS S3 hosts. UI uses text nodes, not source HTML.
- API errors never print upstream errors, SQL, contacts, tokens or cookies. Ensure
  hosting/APM also redact Authorization, Cookie and Set-Cookie headers and disable
  request/response body capture on these routes. The one-time rotate response
  contains a credential and must not be captured by monitoring.

A bearer link is transferable: anyone receiving it can read the whole team's
names/photos/emails and registration/payment status until revocation/expiry. It
cannot identify the actual person reading it or prevent screenshots/copies. Send
only to the appointed team manager through an approved private channel, revoke on
manager departure or suspected forwarding, and confirm this distribution model
with the organization's privacy owner. Contact data is fetched into server/browser
memory for the view, not stored in the link database. Shared computers retain the
8-hour session; “Zamknout” clears it. No team links are automatically sent out.

## Validation and release

`node --test test/registration-control.test.js` covers season filtering, payment
semantics, unknown values, strict scope/coverage, pagination, whitelist, authorization,
CSRF, IDOR attempts, forged/expired admin sessions, link rotation/revocation, outage
revocation, durable rate limiting, digest SQL and actual local HTTP routes.
Run `node --test` for regression coverage.

Before activating live data: verify one paid card registration, one unpaid CASH
registration, one unaccepted invite, an ACTIVE member without a registration, an
old-season INVITED member, latest invite and a multi-team member. Compare exact
counts against all HMS pages. Test wrong-team overrides and revoked existing
cookies on a deployment preview. Verify DB permissions, configured internal code
and hosting header/body redaction. Do not merge as a completed live integration
until these checks pass; draft PR is appropriate while upstream access is missing.
