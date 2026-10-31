# HMS LIVE Show Control · MVP

Open `/studio/announcer` or `/show-control/index.html`. Media Studio links to the panel and passes the selected organization. Designed for a separate 320–480 px browser window beside the HMS timekeeper. No production deployment or HMS writes are required.

## Operating the panel

1. Select the organization, date filter and match using the existing Studio game browser. Imported-only listings are labeled. The match settings collapse after selection.
2. In **Zvuky a týmové profily**, upload your own or licensed audio (maximum 30 MB/file). Set team, organization or organization-local default for each cue. Playback resolves team → organization → default; empty cues are disabled and silent. Mixes accept a single prepared audio file; multi-track playlists are deferred.
3. The grid contains HOME/AWAY pairs for PREGAME MIX, PUCK DROP, GOAL, POWER PLAY, IN GAME MIX and VICTORY. Each side resolves its actual selected team. Add named AD 1…AD X spots in the sponsor editor (up to 40 per organization), then select that AD in the audio profile editor to upload its spot. AD audio always uses the organization profile; stable UUIDs survive label changes. AD names/audio remain browser-local. One music bed and one effect can play concurrently. Pregame and in-game loop; puck drop, goals, power play, AD spots and victory play once. A new cue replaces only its channel.
4. Select an installed Czech voice. Each announcement starts only on **Play TTS**; there is no autoplay. Music and effects duck during speech. Pause/resume affect both audio and speech. **STOP ALL** is always visible and cancels pending speech as well as both channels. An interrupted announcement returns to New.
5. Display 5 or 10 events. Done can be replayed, Skipped can be deliberately played again. An edited announcement is marked OPRAVENO and becomes New. History survives refresh in this browser, separately by organization, match and live/test mode.
6. If HMS is unavailable, select **Ruční test** and add/edit a manual announcement or re-submit the same ID. These events never enter the LIVE ledger or HMS.

## LIVE contract and safety

The panel uses existing GET `/api/studio` for catalog/schedule and `/api/broadcast?org=…&gameId=…&live=1` for a scoped match. No new credentials, endpoints, database tables or write paths were introduced. The existing handler checks both game ID and organization ownership before fetching optional collections with that organization's token. Existing server cache is 10 seconds; panel polls sequentially every 15 seconds with a 15-second timeout. Selection changes abort requests and invalidate late responses.

The additive `showControl` response contains only allowlisted sporting fields:

```json
{"types":["goal","penalty"],"omitted":0,"events":[{"id":"goal:<stable-hms-id>","type":"goal","side":"home","period":1,"clock":"03:20","text":"Gól týmu …"}]}
```

Only explicitly returned LIVE event collections are authoritative, including empty collections. Embedded historical game-detail events never substitute for an unavailable LIVE collection. Missing collections yield null/partial coverage. Goals include a spoken Czech clock, lineup jersey numbers, scorer and assists. Goal ordinal and running score appear only when the existing broadcast model confirms complete events matching the recorded score and unambiguous ordering. Penalties use explicit HMS penalty type/reason, with Czech labels for common English values; absent facts are omitted. Opposite-side penalties with exactly the same known period and clock become one combined announcement; this does not infer that the penalties cancel out.

Final-result and official-star announcements are separate manual Play TTS items only after FINISHED with known final scores. Official stars use the existing HMS `GameStars` source and require an exact player/team match in the validated roster. Public metadata can supply GameStars only after matching game identity, both teams, date and final score. Jersey number and goalie role come from the lineup. No speculative lineup Star flag, statistical MVP award or unpublished final result is invented. Text is composed from verified sporting facts, not claimed to be an HMS-provided announcement sentence.

IDs include event type and normalized stable HMS ID. Identical IDs in a snapshot are deduplicated; conflicting revisions in the same snapshot fail closed. Missing IDs, foreign game/team rows are omitted with a count. Corrections across snapshots reset the announcement status without autoplay. Deleted/missing events in authoritative collections become hidden tombstones; an identical restored revision retains Skipped. Unsupported collections do not delete previous rows. Failed/stale reads disable LIVE TTS and cancel speech; retained event text is never presented as a new verified feed. The playback guard rejects data older than 45 seconds even if a background tab's timer is delayed.

Uploaded Blobs are in the existing browser IndexedDB asset store under `show:v1:<organization>:<profile>:<cue>`. No media or ledger is uploaded. Profiles and history are local to a browser, not shared settings between devices. No third-party songs are bundled. Browser storage failure is reported. Local ledger edits or clearing browser data reset operator history; this is not a server audit log.

## Verification

- `node --test` — 468 passing tests (includes Show Control safety/audio, rich announcements, simultaneous penalties, final result and official-star tests).
- `node scripts/build-static.js` — existing static build passes. It generates the existing Insights demo; Show Control ships as buildless files in `public/` under the existing Node/Vercel routes.
- `PLAYWRIGHT_MODULE=<installed Playwright module> CHROMIUM_PATH=<Chrome executable> node scripts/show-control-browser.mjs` — browser behavior checks at 320/360 px, screenshots and report in ignored `artifacts/show-control/`. Use PowerShell environment-variable syntax on Windows. API and speech are explicit fixtures in these tests; they are not evidence of a real LIVE match or audible speech.

Local unconfigured `/api/broadcast?...&live=1` returns 503, never fabricated data. Real HMS verification requires the deployment's existing scoped organization token and an accessible running match. Audible Czech TTS requires a Czech voice supplied by the OS/browser. Hardware audio routing to PA/OBS is outside browser control and must be checked on the timekeeper's device. STOP/ducking controls this panel, not other applications.

## Deferred

Shared/server-persisted audio profiles, multi-file playlists, ElevenLabs voices, automatic announcements, additional HMS event types and PA/OBS device routing. The proposed central Blob + PostgreSQL library, access model, manifests and migration path are in [SHOW-CONTROL-LIBRARY.md](SHOW-CONTROL-LIBRARY.md); that service is not activated. No production merge/deploy is part of this MVP implementation.
