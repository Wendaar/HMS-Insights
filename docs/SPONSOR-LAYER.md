# Shared HMS Sponsor Layer — Social + Broadcast

The existing sponsor catalog is now one service in `src/app/sponsors.js`.
`/api/sponsors?org=PHM` and the compatibility Broadcast catalog route use the
same org/UUID cache (60 s) and verify the token against `/organization`.
Both Studios and `/sponsors` use the same client/model. No HMS writes or public
organization-configuration writes. The old module remains a re-export.

## Contract and safety

Existing `logoUrl`, `web`, `scopeRefs`, team lists and bindings remain compatible.
Added public fields: `website`, `description`, `active`, `activeSource`, teams and
competitions as UUID arrays, plus structured `logo` with `originalUrl`,
`displayUrl`, `overrideUrl`, safe returned `variants`, numeric `crop` when actually
present, and source provenance. Explicit disabled/deleted/archived records are
excluded. Current HMS does not return a sponsor activity field; `not-disabled`
distinguishes inferred availability from an explicit activity flag.

Only allowlisted public HMS storage URLs enter image metadata. No credentials,
ports, query secrets, redirects or arbitrary image-proxy hosts. Contact/legal
records, raw objects and tokens are excluded. Manual external HTTPS logo URLs
are fetched by the browser; no generic server proxy was added. External PNG
exports still require CORS, with the existing upload fallback.

## Verified image investigation — 2026-10-28

EUCHL sponsor Restaurace Černý Orel has UUID
`900a2f40-d000-11f1-837b-27c5e6cdebf9` and the recorded website
`https://www.restauracecernyorel.cz/`.

- Current selected HMS file ends in `_cropped_md`: JPEG 300 × 300. The eagle and
  name are visibly cut off inside that file. CSS cannot reconstruct them.
- The public HMS frontend retrieves the editor original through
  `/admin/logo?entity=Sponsor&id=…&size=original&role=…` using a signed-in session.
  An unauthenticated read returned 403. Integration credentials are never sent
  to that different admin service and the protected URL is not exposed.
- Guessed storage `_original`, `_original_md` and bare paths returned 403;
  `_md` timed out. This does not prove the objects are absent. No guessed URL is
  relabeled or published as an original.
- Observed integration fields include `logoUrls` and relationship ID arrays,
  without standalone crop/original metadata. Safe returned variants are now
  retained. Only explicit original/uncropped fields qualify as an original.
  Missing original stays null.

### Whole-logo fallback for Černý Orel

The official recorded website serves the complete matching logo at
`https://www.restauracecernyorel.cz/images/logo.png` (200 × 72 PNG).
`public/sponsors/logos/restaurace-cerny-orel.png` is that file unchanged.
It is a verified **override**, not an HMS original or a reconstructed crop.
Attribution remains in `logo.overrideSource`.

The fallback is bound to EUCHL + exact sponsor UUID + matching website, and only
applies if HMS supplies no explicit original. An eventual HMS original takes
precedence. The bundled asset resolves to the current application origin, so
aliases and preview export keep the same-origin image path and authentication.
The 200 px source is suitable for the corner element; a full-screen announcement
will benefit from a higher-resolution original from HMS/the sponsor.

Useful Wootera API improvement: public read-only `logoUrls.original` or
`logo.originalUrl`, plus explicit crop metadata. The client never guesses it.

## Social Studio

The new picker above existing manual fields supports name/nick/short/claim search
with Czech accents. Selecting prefills name and resolved logo. Manual text,
HTTPS URL and uploaded raster images remain editable. Reapply is explicit;
refreshing the catalog never overwrites manual graphic values.

Settings remain in existing org + graphic-type profiles; uploads use IndexedDB.
Org changes clear/abort the catalog immediately and stale selections cannot write
another org's profile. Missing catalog leaves manual entry working. Both PNG
ratios keep full aspect ratio via Canvas scaling.

The catalog page also accepts a browser-local per-org/sponsor URL override.
It is not a shared public configuration write.

## Broadcast operation

1. Select a fixture and connect/create the existing private OBS channel.
2. Choose Partner v rohu or Velké partnerské oznámení, HMS catalog source and
   whole organization or assigned team.
3. Check sponsors, reorder with arrows, optionally override each row's Logo/Pause
   seconds and logo URL, then save selection/order.
4. Global defaults are 15 s logo and 30 s blank. Start automatic rotation.
   Choose all matching items to rotate the selected list, or one fixed item.

Show A → **empty output** → show B → **empty output** → repeat. A third row can
pause 120 s while others inherit 30 s. Show 1–300 s; blank 0–3600 s. No selection
is transparent. Stopped mode holds the first/selected partner; channel Hide still
hides everything. New playlists never silently enable every sponsor.

A 400 ms fade is contained within show duration. Playback uses the published
start timestamp: HMS refresh or page reload in a blank does not restart at A.
Legacy channels without the new timing object retain previous selection/timing
until the operator publishes the new controls. QR rotation remains separate.

The saved channel JSON validates global timing; its protected library validates
per-item timing/override fields. Writes still require the private channel key
and revision. No HMS API token or webhook secret is used by this UI.

Overlay styling is neutral slate, translucent, light text and no brand stripe.
Corner logo area is 260 × 84 at 1920 × 1080; announcement has a larger area.
All logos are centered with `object-fit: contain`, no crop/mask/distortion.
Broken logo images leave the sponsor name visible.

Defaults and saved choices are isolated per organization in this browser; team
choices additionally use team UUID. Saved references are scoped to org and
channel + game/team. Another controller of the same private channel can read its
state/library. This is not global organization-wide editing. A new game/channel
can reuse local choices but requires an explicit save before sending them.

## Verification

Node tests cover identity, safe URL hosts, original-versus-crop provenance,
explicit empty selection, precise 15/30/120 boundaries, fades, zero pause,
looping, library/state validation and URL transport.

`scripts/sponsor-layer-browser.mjs` covers shared org picker/search/autofill,
manual upload persistence, org switching, 8 PNGs including the real official Orel
and wide/square/transparent-tall logos in both ratios, extreme image-edge pixels,
private multi-selection, per-item pause, loop/blank/reload, neutral contain OBS
output, the actual Orel file and 390 px mobile controls.

`scripts/broadcast-expansion-browser.mjs` checks original channel/library/QR,
hide-preserving updates, team/organization sponsors, announcements, standings
and the gallery. Synthetic tests never edit a customer's live OBS channel.
