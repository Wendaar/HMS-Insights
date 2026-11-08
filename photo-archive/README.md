# HMS Photo Archive — read-only pilot

Isolated pilot for four PHM games in `pilot-cases.json`. This code does not write to HMS or change production routes. Node.js 20+; the pilot itself needs no npm dependencies.

## Run

```bash
node photo-archive/pilot.mjs --help
node photo-archive/pilot.mjs --resolve-only
node photo-archive/pilot.mjs --offline --analyze
node --test photo-archive/*.test.mjs
```

For authenticated ingestion, supply `HMS_API_TOKEN` and `FLICKR_API_KEY` as environment variables. Optional `HMS_API_BASE_URL` defaults to the existing HTTPS HMS public API. No `.env` file is loaded automatically. Never commit credentials.

```bash
node photo-archive/pilot.mjs --case 1 --limit 25
```

For jersey analysis, also supply `OPENAI_API_KEY` and `PHOTO_VISION_MODEL` with a model available to your account that supports image input and strict structured outputs. There is deliberately no implicit model selection.

```bash
node photo-archive/pilot.mjs --case 1 --limit 5 --analyze --vision-limit 3
```

`--limit` is 1–500 photos per case. `--vision-limit` is 1–25 API attempts **across the entire run** (default 3); exhausted cases report a blocked analysis. `--case` is 1–4. Unknown, duplicate, missing and non-integer arguments are rejected before requests or output writes.

Exit codes: **0** every requested stage passed; **1** failed/blocked source, analysis or output; **2** invalid CLI invocation. `--resolve-only` skips HMS and all authenticated APIs. `--offline` makes no network requests. Default ingestion still resolves public album links when API keys are missing, then reports each missing credential independently.

## Flickr resolution

The resolver accepts HTTPS canonical `/photos/{owner}/albums/{id}` and legacy `/sets/{id}` URLs directly. Short `/s/{token}` and guest `/gp/{owner}/{token}` links follow bounded, host-validated redirects. If a landing page remains, only canonical and `og:url` metadata can establish the album ID. Conflicting metadata, login pages and unresolved links fail explicitly. Album IDs remain strings; there is no speculative decoding of short tokens.

API metadata uses `flickr.photosets.getPhotos`, validates the returned photoset ID, follows bounded pagination and enforces the sample limit. Preview URLs use the largest API-provided size among `url_b`, `url_z` and `url_m`; image URLs are not invented. API requests reject redirects to avoid forwarding credentials.

## Jersey analysis and review

The analyzer sends the selected Flickr preview URL to the OpenAI Responses API with high image detail, `store:false`, strict JSON schema and no roster names or player IDs. It extracts visible jersey numbers, jersey descriptions and positional evidence, including multiple players and unreadable numbers. Invalid, refused and incomplete responses fail explicitly. This is jersey reading, not face identification.

Outputs are validated locally. A subjective confidence below 0.8 suppresses a number from matching; this threshold is a heuristic, **not measured accuracy**. Model-supplied team IDs are ignored. Jersey colour never establishes a team ID. Matching across the game's validated lineup returns candidates requiring human review; even a unique number is never auto-confirmed. Same numbers on opposite teams remain ambiguous. A review UI and measured accuracy evaluation are still outstanding.

Implementation follows [OpenAI image input documentation](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## Local results

Each invocation creates a fresh `photo-archive/out/run-*/` directory, preventing stale photos or lineups from a previous run being mistaken for current results. `--out PATH` changes the local output root. `summary.json` records separate resolution, HMS, Flickr API and optional vision outcomes. Per-case files contain normalized lineups, photo references and analysis with suggestions. Errors redact configured keys and omit raw provider response bodies.

Generated results are gitignored and may contain player information. They are not intended for public deployment. Images are referenced, not downloaded by this program; enabling analysis lets the configured image provider retrieve the preview.

## Validation status

See [VALIDATION.md](VALIDATION.md) for the observed live results and remaining blockers. Unit and mocked integration tests establish software behavior, not real-world recognition accuracy.
