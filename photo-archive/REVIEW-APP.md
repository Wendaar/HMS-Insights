# Photo Archive review application

The pilot branch adds `/photo-archive?org=phm` and the Hero Hub shortcut `/control/apps/photo-archive?org=phm`. These are real application routes, not the earlier chat mockup. The API is multiplexed through the existing game-summary function to retain the existing Vercel function count.

## Access and scope

- The server is enabled only for Vercel Preview on `codex/hms-photo-archive-pilot`, or explicit `PHOTO_ARCHIVE_LOCAL=1` outside Production.
- PHM only, restricted to the four curated pilot game/album pairs. HMS requests are GET only and validate organization, game and roster identities.
- Sign in with the existing `HMS_PHM_OPERATIONS_SECRET`. Existing valid Operations sessions on the same origin also work. Browser login creates the existing signed, HttpOnly, Secure, SameSite=Strict, eight-hour Operations session cookie. Credentials are not stored in localStorage or URLs.
- All data reads, searches, imports and mutations require authorization. Mutations check same-origin requests. Anonymous `action=access` returns configuration booleans only.

## Review workflow

Select a game/photo. Each AI observation displays candidate checkboxes directly. Unique non-tentative candidates are preselected for convenience, never saved as confirmed automatically. The explicit Confirm selection and close action approves the chosen photo-player links in one click. Confirm selection and supplement saves a draft and opens the full roster; Reject proposals and choose manually saves an empty draft. Manual changes can be saved as in-progress or explicitly acknowledged and closed. Drafts never appear in the confirmed archive. All photos are visible by default: green thumbnail badges show the approved-person count and closed state; amber badges show in-progress state.

Manual search covers the whole verified lineup, with Czech diacritics ignored. All matching players are rendered in a scrollable list, ordered by team then jersey number and name; the old twelve-result limit is removed. Team and role filters narrow the list. The goalie filter uses only verified goalie roles; the other-player filter includes unknown roles, since absent HMS role data is not evidence of being a skater.

Each photo can be confirmed for multiple players. It can instead be rejected, or returned to pending. Existing assignments can be edited from the archive. A note and user-declared reviewer label accompany the recorded Operations role and server timestamp. A shared Operations code does not authenticate an individual person's identity; the reviewer label is not an independently verified identity.

The three pilot AI observations are reused with their photo IDs and remain unverified suggestions. Other photos support manual assignment or explicit album analysis below. Browsing/import/review makes no image-model call. The original Flickr image is not copied; the UI stores/render references, links to the original and offers an in-page zoom of the available preview.

## On-demand album AI

The AI panel lets the reviewer process the selected album (up to 250 photos per run), try three photos, or process the next ten. It uses the existing server-side `OPENAI_API_KEY` and requires `PHOTO_VISION_MODEL=gpt-6-luna`. Version 2 reads numbers, dominant jersey-body colour, goalie/skater equipment and separate confidence scores. It never receives roster names or IDs. The matcher uses `homeJerseyColor` / `awayJerseyColor` from this exact HMS game, never general club palettes. Team filtering requires two known distinct colour families and observed colour confidence at least 0.85; otherwise ambiguity remains. Goalie evidence with role confidence at least 0.85 limits proposals to verified lineup/event goalies. An unreadable goalie number remains tentative. Skater observations exclude verified goalies; unknown HMS roles are not silently declared skaters. Number confidence 0.6–0.79 produces tentative candidates, never automatic preselection; at least 0.8 permits strong suggestions. No unreadable number is invented.

`POST analyze-start` accepts `{gameId,revision,limit,retryFailed,upgradeOld,photoId?}`; `POST analyze-next` accepts `{gameId,revision,jobId}` and processes at most one image. Both use the same Operations authorization, origin checks and Preview restriction as review writes. A database claim is saved before spending, preventing simultaneous duplicate calls. Structured results, model, analysis version and returned token usage persist by photo ID in `analyses`; import preserves this cache, including successful empty results. Explicit `upgradeOld` re-reads pre-v2 results with possible new billing; the UI offers a checkbox for the album or a one-photo button. Current v2 results are reused. Old results are not silently declared colour/role-aware. Later model versions or changed source content do not automatically invalidate cached results in this pilot.

The browser advances sequentially while open, showing progress and offering pause after the current image. Closing/reloading stops issuing more requests; an already accepted request may finish and save. Start again to process only the remainder. Each provider request times out after 35 seconds inside the existing 60-second function. Failures stop the run. Failed or uncertain calls are not silently retried: the reviewer must explicitly select the retry checkbox, acknowledging possible duplicate billing. Claims older than two minutes become interrupted failures on a new start. Auth/quota/rate errors show bounded categories, never provider text or secrets. Returned token counters exclude unknown usage for failed requests and the earlier pilot calls; there is no claimed enforced monthly spend cap.

Result saves merge against the latest database revision, preserving human reviews written during analysis. A storage error never reports a successful save or automatically repeats a paid request. This is a browser-driven pilot queue, not an unattended background worker.

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
