# Validation — 2026-11-08

Branch: `codex/hms-photo-archive-pilot`, PR #61. No merge or HMS mutation was performed. Production source files and deployment are unchanged. Initial local tests made no deployment; the follow-up below used an isolated Preview build.

## Live evidence

Public read-only HTTPS calls successfully resolved all four supplied Flickr short links. A diagnostic fetched the final pages (HTTP 200) and observed matching canonical/og:url metadata. The final implemented CLI separately resolved the same four links through validated redirects:

| Case | Short token | Numeric photoset ID |
| --- | --- | --- |
| 1 | aHBqjD8KrT | 72177720336372497 |
| 2 | aHBqjD8QEj | 72177720336390038 |
| 3 | aHBqjD8UFS | 72177720336403584 |
| 4 | aHBqjD8UFG | 72177720336403574 |

Owner observed for every album: `153512269@N03`. The observed redirect path was `/photos/{owner}/sets/{id}/`; the resolver normalizes it to `/albums/{id}`. The previous scaffold already included a `sets` regex; the improvement adds explicit link-only validation, safe redirect handling, metadata fallback, independently testable functions and useful diagnostics without requiring an API key.

Final live command:

```bash
node photo-archive/pilot.mjs --analyze --limit 2 --vision-limit 1
```

Outcome: **resolution 4/4 passed; exit code 1** because authenticated stages were blocked. The local report was generated at `2026-11-08T19:14:46.936Z`. It records zero vision calls.

## Follow-up: existing Vercel HMS token verified live

After the user authorized reuse of the existing HMS Insights Vercel token, the saved Vercel CLI login was refreshed. Project metadata confirmed `HMS_API_TOKEN` exists as a Sensitive/Secret variable for Production and Preview. The value cannot be exported through the environment-variable API; it was not printed, saved, downgraded or copied.

A minimal isolated **Preview** build ran the unchanged `fetchLineup` adapter with the existing injected token. The test made eight read-only HMS requests: `/game` and `/gameLineup` for each of the four fixed pilot game IDs. All four passed game/team/player identity validation:

| Case | Usable players | Players with jersey numbers |
| --- | --- | --- |
| 1 | 25 | 25 |
| 2 | 27 | 27 |
| 3 | 28 | 28 |
| 4 | 24 | 24 |

Evidence: [private Vercel build logs](https://vercel.com/wendaar/hms-insights/dpl_FLxpV61mt4PN4bMLxKLYHUcTnoMq), deployment state `READY`, deployment target `null` (Preview). Logs contain only fixed game IDs, status and aggregate counts. No roster names, token values or raw HMS responses were published. The deployment's only public output is a generic test-complete page. No production alias, environment variable, project setting or main branch was changed.

**The HMS credential/live-lineup blocker is resolved for execution inside Vercel Preview.** The local shell still cannot export the write-only Secret; subsequent authenticated tests should execute where Vercel injects it.

## Remaining blockers / initial unavailable credentials

- `HMS_API_TOKEN` was unavailable during the initial local run. The follow-up Preview test above has now verified both authenticated endpoints and the lineup adapter for all four pilot cases.
- `FLICKR_API_KEY` was unavailable: no `flickr.photosets.getPhotos` call was made. Album counts, API visibility and image previews remain unverified.
- `OPENAI_API_KEY` was unavailable; `PHOTO_VISION_MODEL` must also be configured before analysis: no live image analysis was made. No recognition accuracy, recall or correct player assignments have been measured.

Credential availability was checked without printing values in both the sandbox and the network-enabled process. No populated project `.env` files were found. Public HTML access does not establish Flickr API permission. No credentials were recovered from unrelated application stores.

## Automated checks

- **22/22 pilot tests passed**: CLI subprocess help, invalid arguments and exit codes; offline/no-network mode; recorded Flickr redirects; guest-page metadata; pagination and album identity; HTTPS/redirect boundaries; HMS game/team/player binding and GET-only requests; structured vision requests, low-confidence suppression, invalid/refused/incomplete output; multiple players and ambiguous numbers; mocked ingestion → vision → candidate matching; global image-call budget.
- Full repository `node --test --test-reporter=dot` passed; a final `node --test --test-reporter=spec` run after the last code edits reported **518/518 passed, zero failures**. `pnpm install --frozen-lockfile` installed existing dependencies. The first attempt lacked `@vercel/blob` and had eight failures; those were resolved by installing the existing lockfile dependencies. No dependency declaration or lockfile changes were required.
- Network requests from the sandbox were blocked; the successful live validation used the approved network-enabled execution.

Next real test: supply the credentials and explicit vision model securely, run one case with a small image budget, inspect the stored lineup/photo/analysis artifacts, then manually label jersey observations before evaluating accuracy. Human review UI and any persistent archive are outside this implemented CLI pilot.
