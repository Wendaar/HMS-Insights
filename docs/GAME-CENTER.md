# HMS Data Engine · Game Center MVP

The existing server-side pipeline is the first increment of the shared engine:

`HMS → normalizeHmsGame → analyzeHmsResponses → transactional normalized storage → GameSummary v1 → Game Report / media consumers`

Příklepy remain a derived product of the same normalized data and keep their existing rules, feed, archive and HMS links. Public Příklepy details now also link to the local Game Report. No second HMS integration or client-side token is introduced.

## Routes

- `/game-center/:gameId`: public server-rendered Czech Game Report.
- `/api/game-summary?gameId=:gameId`: public allowlisted JSON contract, `schemaVersion: 1`.
- Both return 400 for malformed IDs, 404 for games not yet imported, 405 for unsupported methods, and 503 for unavailable storage. Errors never include database exceptions. Successful responses use a 60-second shared cache with up to 300 seconds of stale revalidation.

The report includes the stored HMS result, competition context, ranked players, recorded goalie statistics and all Příklepy. It works for games with zero Příklepy, too. The contract deliberately omits raw responses, arbitrary facts, contact data and internal organization identifiers. It is intended to be public, like the existing feed; organization-specific access controls would need a separate authenticated contract.

## Import triggers and corrections

No `game.finished` event is necessary to read or build a summary. The existing authenticated manual import (`POST /api/admin/import-game`), backfill and `game.updated` webhook all use `processFinishedGame`. A correction replaces the full normalized snapshot and recomputes Příklepy. Replacement now runs in one Neon transaction, with a transaction-scoped advisory lock per game to serialize concurrent writers. Readers aggregate the game and its children in one SQL statement so they observe a single committed snapshot.

This increment still imports **finished games only**, as required by the existing normalizer and SQL constraint. The function name `processFinishedGame` describes that current constraint, not a mandatory event trigger. LIVE/scheduled games will need a separate synchronization path and explicit schema/status evolution before enabling new event types. Do not remove the guard and run final-result Příklepy rules on live scores.

## Existing imports and rollout

No migration or new environment variables are required beyond the existing migrations 001–004 and `DATABASE_URL`. Existing imported games are readable without reimport, including the user-verified test game:

`/game-center/F6321894-98CA-11F1-8BDF-EF2495D048F3`

The user supplied an expected **9:3 and 10 Příklepy** for that ID. Read-only acceptance verification on the Vercel preview on 19 October 2026 found different stored data:

| Game ID | Stored match | Result | Příklepy |
| --- | --- | --- | --- |
| `F6321894-98CA-11F1-8BDF-EF2495D048F3` | Hc Slavoj Zbraslav – HC Kosti | 5:10 | 4 |
| `F6312E3A-98CA-11F1-8BDF-EF2495D048F3` | PUK PAK PIVO – HC Kosti | 9:3 | 10 |

Both reports were verified against the deployed Vercel preview using the existing database. No IDs were remapped and no stored data was changed to match the expectation. Local tests use only sanitized fixture data; Vercel handlers never substitute fixtures. Preview: `https://hms-insights-git-codex-hms-game-center-wendaar.vercel.app`.

The public report cannot fetch/import a missing game. It returns 404 until an authorized import has completed. Merge/deployment is a separate release decision; this PR does not modify Vercel environment values.

## Data limits and next increments

- Score comes from the stored normalized HMS result, which prefers official scores over event counts. Player and goalie statistics come from recorded events and can be incomplete.
- Earlier imports did not persist goal timelines, official-score override provenance or event completeness. `eventCoverage: "unknown"` and `timelineAvailable: false` make that explicit. Do not fabricate timeline events from the score or calculate save percentages from incomplete goalie attribution.
- `provenance.updatedAt` is the import timestamp, not a guarantee of live freshness.
- Media Studio and future OBS graphics can consume GameSummary v1; those clients and live refresh are outside this increment. Next steps are persisted event snapshots with coverage/provenance, schema support for live status, and a trigger-neutral synchronization service with retry/reconciliation.

## Verification

Run `node --test` after installing dependencies. Tests cover the existing Příklepy suite plus summary mapping, corrected/manual imports, malformed IDs, empty/missing games, public field allowlisting, HTML escaping, safe HTTP failures and transactional batching. Transaction rollback/concurrency semantics should additionally be verified against a disposable Postgres database before relying on production fault-injection claims.

`node src/server.js` offers a local fixture preview at `/game-center/F6312E3A-98CA-11F1-8BDF-EF2495D048F3` when `DATABASE_URL` is absent. Set `DATABASE_URL` to read stored data locally. Vercel handlers never fall back to demo data.
