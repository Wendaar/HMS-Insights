# HMS Photo Archive — pilot

Independent **read-only** prototype in the `codex/hms-photo-archive-pilot` branch; production and current apps are unchanged.

## Input
Four HMS game ID / Flickr album URL pairs are in [pilot-cases.json](pilot-cases.json).

## Run

Node.js 20+ is required. Use secure environment variables (never commit secrets):

```bash
export FLICKR_API_KEY='your private key'
export HMS_API_TOKEN='your private token'
export HMS_API_BASE_URL='https://public-api.prod.hms.wootera.net/api/v1' # optional; existing client default
node photo-archive/pilot.mjs --limit 25
```

The pilot now reuses `src/hms/client.js`: `fetchGameDetail` and `fetchGameLineup` call the existing verified `/game` and `/gameLineup` routes, using a server-side Bearer token. No new endpoint template is required. If credentials are missing, a clear per-source error is recorded without inventing any data.

Flickr album IDs are derived from short links using the album endpoint redirect. Flickr metadata uses `flickr.photosets.getPhotos` and obtains image URLs only when the API supplies them. It stores **references only**, not image files.

Results are saved to `photo-archive/out/` (gitignored). The script NEVER writes to HMS. API responses may contain player information, so do not deploy generated output publicly.

## Status / next step

This is a data-ingestion scaffold, not yet a completed or measured AI-identification pilot. We must verify real HMS lineup response fields, authorize Flickr access and inspect sample photos. Number detection, review UI and any photo-player association will follow after validating ingested inputs. No accuracy claims until manual labels exist.

## Planned association record

`organization_id, game_id, team_id, player_id, flickr_album_id, flickr_photo_id, jersey_number, proposed_evidence, status (suggested|confirmed|rejected), reviewed_by, reviewed_at`.

A photo can have multiple players; jersey number alone is not unique across teams. Avoid face-based biometric identification.

## Candidate matcher

`node --test photo-archive/matcher.test.mjs` tests conservative matching of jersey number and verified team ID. `suggestPlayers` never automatically confirms a player, and handles multiple players on a single photograph independently. A visual model still needs to supply jersey observations; model integration and human review UI are not complete. Do not treat matching unit tests as measured real-world photo recognition accuracy.
