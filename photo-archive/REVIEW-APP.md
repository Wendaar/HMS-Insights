# Photo Archive review application

The pilot branch adds `/photo-archive?org=phm` and the Hero Hub shortcut `/control/apps/photo-archive?org=phm`. These are real application routes, not the earlier chat mockup. The API is multiplexed through the existing game-summary function to retain the existing Vercel function count.

## Access and scope

- The server is enabled only for Vercel Preview on `codex/hms-photo-archive-pilot`, or explicit `PHOTO_ARCHIVE_LOCAL=1` outside Production.
- PHM only, restricted to the four curated pilot game/album pairs. HMS requests are GET only and validate organization, game and roster identities.
- Sign in with the existing `HMS_PHM_OPERATIONS_SECRET`. Existing valid Operations sessions on the same origin also work. Browser login creates the existing signed, HttpOnly, Secure, SameSite=Strict, eight-hour Operations session cookie. Credentials are not stored in localStorage or URLs.
- All data reads, searches, imports and mutations require authorization. Mutations check same-origin requests. Anonymous `action=access` returns configuration booleans only.

## Review workflow

Select a game, optionally refresh/import its Flickr metadata and HMS lineup, then select a photo. Search the game's verified lineup by player name, jersey number or team (Czech diacritics are ignored). Select one or more players, inspect the enlarged image, acknowledge that player/team identity was checked, and confirm. Assigning does not require an AI suggestion. Ambiguous model candidates are searched, never all selected automatically.

Each photo can be confirmed for multiple players. It can instead be rejected, or returned to pending. Existing assignments can be edited from the archive. A note and user-declared reviewer label accompany the recorded Operations role and server timestamp. A shared Operations code does not authenticate an individual person's identity; the reviewer label is not an independently verified identity.

The three pilot AI observations are reused with their photo IDs and remain unverified suggestions. Other photos support manual assignment. Browsing/import/review makes no image-model call. The original Flickr image is not copied; the UI stores/render references, links to the original and offers an in-page zoom of the available preview.

## Durable storage

State is stored in the existing `hms_tool_instances` table under **tool=`photo-archive-preview`**, organization `PHM`, slug=lowercase game ID. No HMS, production archive, media-selection or published-content record is mutated. `DATABASE_URL` is required for saves; a missing database fails explicitly.

Each game state contains minimal verified lineup snapshots, safe Flickr image references, photo decisions and the latest 1,000 audit events. A decision retains player ID, team ID and a sporting display snapshot. The archive groups confirmed links by stable HMS player ID across games, keeping historical jersey/team context per photo. Refresh preserves saved decisions and old references; it does not silently remove historical confirmed links when source albums change. Availability of external photos is not guaranteed.

Revision checks use compare-and-swap in the existing store. A stale editor receives HTTP 409 and must reload; concurrent writes do not overwrite newer decisions. Nothing is auto-confirmed. Initial live import leaves every photo pending.

## API contract for later photo pickers

Base route `/api/photo-archive?org=phm` (equivalent to `/api/game-summary?view=photo-archive&org=phm`):

| Action | Method | Purpose |
| --- | --- | --- |
| `access` | GET | Configuration / authorized / storage status |
| `session`, `logout` | POST | Existing Operations session lifecycle |
| `catalog` | GET | Curated games and stored review counts |
| `case&gameId=…` | GET | Persisted photo queue, lineup and review state |
| `import` | POST | Refresh a curated case using `{gameId, revision}` |
| `decide` | POST | `{gameId, photoId, revision, decision: assign|reject|reset, playerIds, reviewer, note}` |
| `archive` | GET | Confirmed photos grouped by player across pilot games |
| `player-photos&playerId=…` | GET | Confirmed photo references only, omitting reviewer/audit details |

The protected `player-photos` projection is the integration point for future Studio, Insights, Broadcast and Socials pickers. Those apps have **not yet been modified to select/use archive photos**. Publication permissions, image attribution/licensing and public-delivery contracts should be set before making such a picker public. HMS profile portraits remain separate.

## Seed and verification

A Preview commit message containing `[photo-review-seed]` imports the four cases only when missing. It uses no image-model call. A separate `photo-archive-persistence-qa-preview` tool namespace stores synthetic fixture records to verify durable save/read/reset without creating real player-photo confirmations. The normal UI never reads that QA namespace.

Automated tests cover scope/auth/cookie/origin boundaries, imports and refresh preservation, multiple players per photo, stable-ID aggregation, rejected/reset exclusion, stale revisions, foreign references, missing storage, API projection and local routes. Browser interaction QA uses an explicitly synthetic local fixture, including search, confirmation, archive expansion, reload, reset, zoom and narrow layout. Live seed and Preview route results are recorded in VALIDATION.md after deployment.
