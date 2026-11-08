# Validation — 2026-11-08

Branch: `codex/hms-photo-archive-pilot`, PR #61. No merge or HMS mutation was performed. The main branch and Production deployment are unchanged. The branch includes application changes deployed only to Preview. Initial local tests made no deployment; follow-ups below used isolated Preview builds.

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

## Follow-up: Flickr API key verified live

The supplied key was saved as `FLICKT_API_KEY`, including a branch-specific Preview Secret for `codex/hms-photo-archive-pilot`. Vercel rejects renaming a Sensitive variable; the attempted rename returned HTTP 400 and made no change. The Preview check accepts this existing name as an in-memory alias for `FLICKR_API_KEY`. No secret was exported or logged, and the separate Production entry was not modified.

An inline non-Git Preview did not receive the branch-specific key. A real Git Preview build of commit `3996765feb0d015d33e39ba519958541ced164f8` then received both existing secrets and passed the live ingestion checks. [Private build evidence](https://vercel.com/wendaar/hms-insights/dpl_DrhEPcBx8YEDBgv4UNhiDLZjDSHN), state `READY`, target Preview:

| Case | HMS players / with numbers | Flickr album total | Metadata sample | Preview HEAD check |
| --- | --- | --- | --- | --- |
| 1 | 25 / 25 | 32 | 3, all with previews | HTTP 200, image content type |
| 2 | 27 / 27 | 24 | 3, all with previews | HTTP 200, image content type |
| 3 | 28 / 28 | 66 | 3, all with previews | HTTP 200, image content type |
| 4 | 24 / 24 | 108 | 3, all with previews | HTTP 200, image content type |

All four `flickr.photosets.getPhotos` calls succeeded using the existing resolver and Flickr client. Total album inventory: **230 photos**; **12 metadata records** sampled; **4 preview HEAD requests** verified availability and image content type. This did not download or visually inspect the images and did not run the image model.

The bounded checker is in `photo-archive/preview-check.mjs`. A guarded hook in `scripts/build-media-client.js` runs it only for `VERCEL_ENV=preview` and the exact pilot branch. The hook emits aggregate results to private build logs and writes no rosters/photos into public output. It never writes to HMS. Final regression suite: **520/520 tests passed**, including two additional checks for the production guard and alias/redaction behavior.

## Follow-up: OpenAI Preview redeploy and confirmed credit blocker

After the user saved the OpenAI key/model and requested redeploy, the real pilot Git Preview received `OPENAI_API_KEY` and `PHOTO_VISION_MODEL=gpt-5.4-mini`. The checker now supports an explicit `[photo-vision-test]` commit marker, with at most three image calls per marked build. Ordinary unmarked builds perform no image-model calls. After HTTP 401, 403 or 429, remaining image calls are suppressed while read-only ingestion checks continue.

Two marked test builds were observed as `READY` (Preview), each making one rejected image call and zero successful analyses:

- Initial [Preview build](https://vercel.com/wendaar/hms-insights/dpl_2TYUwnZWAVUs1ivEWM7xphaX7SZc): HTTP 429; remaining calls stopped.
- Diagnostic [Preview build](https://vercel.com/wendaar/hms-insights/dpl_DBdCwMXL18RoRk7WiQzd7DbKcPKd), commit `78e51f652e0fa45a46b465047ca2749951eaec1c`: **HTTP 429, `code=credit_balance_exhausted`, `type=insufficient_quota`**. The API organization has no prepaid credit available. No further requests should be made until the API billing balance is restored.

Both builds again passed HMS and Flickr ingestion for all four cases with the same roster counts and album totals as above. The first Flickr photo selected for attempted analysis was `55634736411`. No model observations, jersey readings or player identifications were returned; recognition accuracy remains unmeasured. `READY` establishes deployment readiness, not successful AI analysis.

The updated error handler reports only bounded provider error identifiers and a fixed error category; it omits raw provider error text. The latest automated suite reported **523/523 passing tests**, including the three-image bound, stop-after-quota behavior and filtered diagnostics.

Required user action: add API credits in the OpenAI organization that owns the key through [API Billing](https://platform.openai.com/settings/organization/billing/overview). The current key and model do not need to be changed on the evidence available. Once credit is available, explicitly rerun the small marked test. See [official error-code guidance](https://developers.openai.com/api/docs/guides/error-codes).

## Follow-up: three successful GPT-6 Luna image analyses

After the user added API credit and changed the Vercel model, [Preview build evidence](https://vercel.com/wendaar/hms-insights/dpl_G2sBsM7m9gzVnqp2u247k5sqzLZn) for commit `4b747b181e83230286997c2d6b2e220ae16eecd0` confirmed `gpt-6-luna`, state `READY`, target Preview. All four HMS/Flickr ingestion cases passed again. **Three image calls completed successfully**; the fourth case made no image call because the global three-image budget was reached.

| Case / Flickr photo ID | Model result (not manually verified) | Input tokens | Output tokens (includes reasoning) |
| --- | --- | --- | --- |
| 1 / 55634736411 | Three observations; possible `16` at subjective confidence 0.72 suppressed from matching; other numbers unreadable | 520 | 523 |
| 2 / 55635051690 | Two observations; `22` at 0.98 proposes one roster candidate for review; another number unreadable | 520 | 228 |
| 3 / 55633060430 | Two observations; `13` at 0.94 proposes one roster candidate for review; another number unreadable | 520 | 264 |

No player was confirmed automatically. These are model readings and conservative candidate counts, not manually verified correct numbers or player identities. The two unique roster candidates remain `review`. The fourth album's images were not analyzed in this run.

Total measured usage: **1,560 input tokens, 1,015 output tokens, zero cached input tokens**. The 550 reasoning tokens are included in output tokens and must not be billed a second time in the calculation. At the published Standard Luna rates of $0.10/M input and $0.50/M output, estimated model-token cost is **$0.0006635 for all three images**, or $0.00022117/image, excluding tax. This is calculated from returned usage, not reconciled against an invoice. [Model rates](https://developers.openai.com/api/docs/models/gpt-6-luna).

Extrapolating this exact tiny sample gives about **$0.35 per 1,600-photo week** or **$1.53 per 6,933-photo month**. This is not a forecast or guaranteed cap: the three 1024px-preview inputs, visible player counts and short outputs do not establish the distribution of a full season. Crops, larger images, extra passes and harder scenes can increase usage. A larger manually labeled sample is still needed to evaluate cost and accuracy together.

The test explicitly pins the Preview checker to Luna, uses low reasoning effort for Luna, and returns bounded token counters. An unexpected configured model is blocked before spending image credits. Full regression suite: **525/525 tests passed**. An account/project monthly hard spend limit has not been verified by this test. No full-album or recurring paid processing was enabled.

## Current status and historical credential checks

- `HMS_API_TOKEN` was unavailable during the initial local run. The follow-up Preview test above has now verified both authenticated endpoints and the lineup adapter for all four pilot cases.
- The initial local run lacked `FLICKR_API_KEY`. The branch-specific Preview key and Flickr metadata/preview availability are now verified through the alias described above.
- The previous OpenAI credit blocker is resolved. Three live Luna image analyses have now succeeded. Recognition accuracy and correct player identity remain unmeasured because manual labels/review are pending.

Credential availability was checked without printing values in both the sandbox and the network-enabled process. No populated project `.env` files were found. Public HTML access does not establish Flickr API permission. No credentials were recovered from unrelated application stores.

## Automated checks

- The initial **22/22 pilot tests passed**; seven additional tests now cover Preview production exclusion, typo alias/redaction, the live-image budget, quota-stop behavior, safe error identifiers, Luna usage counters and unexpected-model blocking. CLI subprocess help, invalid arguments and exit codes, offline mode, Flickr redirects/metadata/pagination, identity binding and conservative matching remain covered.
- The latest full repository `node --test --test-reporter=spec` run reported **534/534 passed, zero failures**, including the nine review/archive tests described below. `pnpm install --frozen-lockfile` installed existing dependencies. The first attempt lacked `@vercel/blob` and had eight failures; those were resolved by installing the existing lockfile dependencies. No dependency declaration or lockfile changes were required.
- Network requests from the sandbox were blocked; the successful live validation used the approved network-enabled execution.

Next evaluation: manually review the three model readings in the implemented review UI, then use a larger representative labeled sample before expanding paid processing. Review decisions and photo references now have durable storage. A general AI-analysis cache and verified monthly spend enforcement remain unimplemented.

## Follow-up: deployed review UI and persistent player archive

Commit `d5d539d189c840c94e6c8e27ccdf87245983852f` deployed to [the pilot review application](https://hms-insights-hrkizyzb6-wendaar.vercel.app/photo-archive?org=phm). [Private build evidence](https://vercel.com/wendaar/hms-insights/dpl_E4jypAbhgWf1yScSDiozuzN2yYBU) reports `READY`, Preview, all four HMS/Flickr cases successful and **zero image-model calls**. The live browser rendered the actual Fotoarchiv login screen and Operations-code prompt successfully. It did not expose roster or archive data before sign-in.

The `[photo-review-seed]` build imported **230 photo references** (32/24/66/108) and **104 game-roster entries** (25/27/28/24; not a count of unique people). All four cases reported `persisted:true`. Real photos remain pending; no real player-photo assignment was confirmed by this test. Three earlier model observations appear as unverified hints only.

Durable database verification ran in a separate `photo-archive-persistence-qa-preview` tool namespace with synthetic player/game identifiers. It saved a confirmation, reconstructed the service, read the confirmed archive, then reset it and verified removal from that archive. The build reported `durableSaveReadConfirmed:true`, `resetConfirmed:true`, `isolatedFixtureNamespace:true`, final revision 3. The actual review UI never reads that QA namespace.

The UI supports game/photo selection, Czech-insensitive player search, manual assignment to one or multiple roster players, required human acknowledgement, rejection/reset, zoom, and expandable confirmed archives grouped by stable HMS player ID. Saves use the existing database with revision conflict detection. Authentication reuses PHM Operations; the reviewer label is user-declared, not an independently authenticated individual identity.

Local browser QA used explicitly synthetic players and placeholder images: login, name search, confirmation, archive expansion, reload, reset, zoom and narrow mobile layout passed. This establishes UI behavior, not recognition accuracy or the correctness of real player identities. A real Operations-authenticated end-to-end browser review was not performed; its existing private access code was not exported. Server-side durable persistence was independently verified in the live Preview build as above.

The full repository suite passed **534/534** tests and the media-client build completed successfully. Nine new automated tests cover authorization/environment/origin boundaries, safe import and refresh, multiple assignments, stable player IDs across jersey changes, revision conflicts, reset/audit, protected photo projections, storage failure and local routes.

Studio, Insights, Broadcast and Socials have not yet been changed to consume archive photos. A protected confirmed-only `player-photos` API projection is available for that next integration. No HMS write, main-branch update, Production deployment, new image-model spending or secret change was performed. See [REVIEW-APP.md](REVIEW-APP.md) for the route, data contract and exact scope.
