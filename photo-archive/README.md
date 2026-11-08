# HMS Photo Archive — read-only pilot

Isolated pilot for four PHM games in `pilot-cases.json`. This code does not write to HMS or change production routes. Node.js 20+; the pilot itself needs no npm dependencies.

The pilot now includes a real authenticated [review application](REVIEW-APP.md) at `/photo-archive?org=phm` in its Vercel Preview: manual player search/assignment, multi-player confirmations, rejections/resets and a persistent player archive. It uses the existing project dependencies and Operations login. Future Studio/Broadcast/Socials photo selection is prepared through a protected projection API; consumer apps are not changed yet.

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

## Obtaining and storing the Flickr key

Flickr currently requires a **Pro** subscription to request a new API key. Sign in, open [API Keys](https://www.flickr.com/services/api/misc.api_keys.html), choose **Apply for your key online now**, and select Non-Commercial or Commercial according to the actual intended use. Suggested application name: `HMS Photo Archive`; describe read-only access to public hockey match albums and jersey-number analysis. Use the issued **Key**, not the application Secret. Public `flickr.photosets.getPhotos` requests require the API key but do not require a Flickr user OAuth login.

Enter the key directly in the Vercel dashboard for `hms-insights` → Environment Variables (also accessible through Settings → Environment Variables): name `FLICKR_API_KEY`, type **Secret** (legacy UI: Sensitive), environment **Preview**. Keep Production unselected for this pilot. Do not use `NEXT_PUBLIC_` or `VITE_` prefixes and do not send the value in chat or commit it. A new Preview execution will receive the key; the local CLI does not automatically inherit Vercel Secrets.

The current pilot branch also accepts the already-saved `FLICKT_API_KEY` spelling in its bounded Preview build check, mapping it in memory only. There is no need to re-enter that Secret for testing. The standalone CLI still uses the standard `FLICKR_API_KEY` name. The Preview hook runs only on `codex/hms-photo-archive-pilot`, reports aggregate counts and one image HEAD check per album in private build logs, and does not run in Production.

For the optional small live image test, the Preview hook requires a commit message containing `[photo-vision-test]`. It attempts at most three images across the four cases and stops further calls after authentication, permission or quota/rate rejection. Unmarked builds make no image-model calls. Vision output logs contain only photo references, jersey-number observations, subjective confidence and candidate counts; no roster names or player IDs. `READY` means the deployment built, so inspect `PHOTO_ARCHIVE_RESULT`/`PHOTO_ARCHIVE_TOTAL` in private logs for actual source and analysis outcomes. A `credit_balance_exhausted` response requires API credit in the key's OpenAI organization before retrying.

The current low-cost Preview test is pinned to `gpt-6-luna` and blocks image requests if the configured model differs. Luna uses low reasoning effort. Successful analysis records returned input/output/cached/reasoning token counters; reasoning is already part of output usage. The first three-image Luna run succeeded after credit was added; see VALIDATION.md for its measured token cost and the limits of extrapolating from this small sample. No automatic full-album processing or verified persistent monthly cap is enabled.

Sources: [Flickr key application instructions and Pro requirement](https://www.flickrhelp.com/hc/en-us/articles/4404070036884-Flickr-API), [public photoset API authentication requirements](https://www.flickr.com/services/api/flickr.photosets.getPhotos.html), [Vercel Secret variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
