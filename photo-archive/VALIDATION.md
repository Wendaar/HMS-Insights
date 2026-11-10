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

## Follow-up: on-demand album AI — 2026-11-09

Commit `d427e144dc4c89468d2b2b01186c8e741e52f012` added the album AI panel, sequential authenticated actions, durable per-photo analysis cache and explicit retry behavior. [Private Preview build evidence](https://vercel.com/wendaar/hms-insights/dpl_G7pApVASPt9qu1ELTTraSDsYEQ1k) reports `READY`. The explicit `[photo-album-ai-smoke]` marker exercised the same authorized `analyze-start` / `analyze-next` handlers used by the browser, using the injected Operations credential in memory. It analyzed exactly three previously uncached photos from case 1 with `gpt-6-luna`, then reconstructed the service and verified every result in the real Preview database. This is separate from the older CLI three-image test. Ordinary builds still make no model call.

| Photo ID | Status | Roster candidates | Input / output tokens |
| --- | --- | --- | --- |
| 55634736421 | complete | 0 | 520 / 367 |
| 55635158920 | complete | 1 | 520 / 143 |
| 55633749902 | complete | 0 | 520 / 507 |

All three results persisted; the run completed after three requests. Total returned usage: 1,560 input, 1,017 output, 2,577 total tokens, zero cached input. Reasoning tokens are already included in output. No real assignment was confirmed. Candidate count is not verified identification accuracy. The three original pilot observations remain available without new calls.

The live new route rendered its Operations login screen. Local browser QA on synthetic data verified start, progress, pause request, cached results after reload, explicit display of candidate names and separate manual roster controls. Synthetic names/screenshots are not evidence of real-image accuracy. A real authenticated browser click-through remains unverified because the private Operations code was not exported; the live smoke test independently verified the actual HTTP handler and durable model-result path.

The full automated suite passed **540/540** tests; the media-client build passed. Six new tests cover durable reuse/resume, no duplicate paid calls under concurrency, preserving human reviews during model requests, quota-stop/redaction, explicit failed/interrupted retries, successful empty-result caching, bounds and HTTP authorization/model guards. The UI can deep-link a game/photo and initially favors an available player suggestion. Final documentation-only/unmarked deployment makes no additional image-model calls.

Remaining scope: unattended background workers, automatic cache invalidation for changed image content or model versions, a general enforced monthly spend cap, larger labeled recognition evaluation and downstream Studio/Insights/Broadcast/Socials pickers. The album operation itself is implemented; it needs the browser left open to advance between photos. See REVIEW-APP.md for failure/unknown-charge handling.

## Match jersey context, goalie roles and review closure — 2026-11-09

Commit `11c015a2d2641c69d6fcda8f4e2ef1882607ae3d` deployed `READY` in [the private Preview build](https://vercel.com/wendaar/hms-insights/dpl_C6pRwQKEMH87jGpeGSLfgaW6Sji2). The marked `[photo-context-smoke]` test refreshed the four pilot sources without changing reviews and verified explicit HMS game jersey fields:

| Case | Home match jersey | Away match jersey | Verified goalie identities |
| --- | --- | --- | --- |
| 1 | HC Traverzáci, #b71c1c, red | Vikings, #ffffff, white | 2 |
| 2 | HC Domynos Praha, #303f9f, blue | PUK PAK PIVO, #ffffff, white | 2 |
| 3 | Prague Pigeons B, #1a237e, blue | HC Rekreanti Praha, #ffffff, white | 2 |
| 4 | Ice Spiders, #ffffff, white | HC Destroit, #000000, black | 2 |

These are `homeJerseyColor` / `awayJerseyColor` values for each actual game, not general team colours. Goalie roles come from explicit lineup flags or non-deleted saves/allowed-goal events. Other roles remain unknown when HMS does not provide them (23/25/26/22 unknown roles respectively); they are not silently certified as skaters.

Exactly two requested screenshot photos were re-read with v2 colour/role outputs and their new results persisted in the actual Preview database:

- `IMG_7785`, photo `55633749862`: white 19 at number confidence 0.98, colour confidence 0.94 -> **one Vikings candidate**, excluding Traverzáci. A second partly visible person remained unreadable.
- `IMG_7798`, photo `55634871738`: red 19 (0.98) -> **one Traverzáci candidate**; red 6 (0.96) -> **one Traverzáci candidate**; white 70 (0.78) -> **one tentative Vikings candidate**, not preselected. The rightmost white player's number remained null at 0.35 confidence. The user reports 71 there; the model has **not** verified that reading and does not invent the missing number.

Total returned usage: 1,412 input + 1,401 output tokens, zero cached input. Both calls completed and persisted. Model readings/candidates still need human approval; no real player-photo assignments were confirmed by this test. No actual goalkeeper photograph was analyzed in this run; goalie narrowing is implemented and covered with synthetic tests, not a measured live goalie-accuracy claim.

The UI now shows candidate checkboxes directly, preselects only unique non-tentative suggestions, supports explicit quick closure, saves supplement/manual flows as in-progress, and includes only closed confirmed links in the archive. All photos remain visible by default. Green thumbnails show approved-person counts and closed state; amber marks saved in-progress work. Full manual search renders all matches sorted by team/number/name with team/role filters; the former alphabetical twelve-result cap is removed.

Local synthetic browser verification passed: contextual colour narrowing, preselection, one-click confirmation, save as in-progress, adding a second person, explicit closure, two players in the archive, and reload retaining a green two-person closed badge. Screenshots use placeholder images and synthetic names; they are not real-image recognition evidence. The live route/authenticated code-entry browser path is not a substitute for the separately verified live server-side analysis results.

Full regression suite: **549/549 passed**, including nine additional context/role/upgrade/draft tests; media-client build passed. Old pre-v2 image results are labeled as such and upgraded only by an explicit paid request for that photo or via the album upgrade checkbox. Ordinary unmarked builds spend no image credits. No HMS writes, main-branch changes, merge, Production deployment or secret change occurred.

## Organization discovery and shared picker — 2026-11-10

The archive is now organization-scoped rather than restricted to four cases. The existing PHM data and namespace are retained. Discovery reads a bounded date/page range of HMS games, validates organization/game identities, and obtains album references from HMS detail or identity-matched public multimedia metadata without forwarding an API token. Saved links remain available when HMS omits a link. A protected manual-link action verifies game ownership and stores the link in the archive catalog without changing HMS.

Album states now distinguish new, in progress, reviewed and closed. Closure requires resolved photos and complete inventory pagination. New photos or a partial refresh of a larger album reopen work; existing assignments survive. The explicit reviewed marker is separate from fully closed. Flickr imports support further pages of 250 references. Human review, paid AI execution and metadata synchronization remain separate actions.

The same `public/photo-picker` dialog is connected to All Stars, Social Media Studio/individual Insights, and Broadcast Studio. HMS remains the default, the private archive offers only that player's confirmed photos, and uploads are converted to bounded JPEG data. All Stars choices enter validated saved/frozen lineups; Studio passes them into its existing canvas; Broadcast transports at most six choices through the existing protected permanent OBS channel. Choosing a photo does not mutate its HMS portrait or sporting data. A standalone URL on another device does not transport device-local uploads; use the permanent channel.

Local synthetic browser verification demonstrated the All Stars picker opening at the selected player, organizational Operations login, an exact-player confirmed archive result, application to the graphic, local restoration after reload, own-file upload/conversion, and source labels `archiv` / `vlastní`. The fixture used a placeholder image and synthetic name; it is not evidence of real-image identification accuracy. The shared-dialog screenshot is a fixture screenshot. Browser publication and a real OBS application session were not executed; server-side publication/channel identity and authorization behavior is covered by tests.

The final local suite passed **578/578 tests**, including 13 shared-picker/discovery tests: organization/token/cookie isolation, confirmed-player binding for publication, closure/reopening, full-page refresh coverage, multimedia identity checks, manual attachment, Flickr continuation, source validation, All Stars photo retention, and Broadcast/channel projection. The media-client build passed outside the Windows sandbox after esbuild was denied access to a parent directory inside it; no code workaround or dependency change was introduced.

Live verification of commit `3f160f7ee267fcba18ebf1cd2c8939642599f12e`: [private Preview build evidence](https://vercel.com/wendaar/hms-insights/dpl_F816t3mbpcafw3JHjSXj8vYGG6EX), state **READY**, target Preview. PHM discovery returned twenty games on the sampled page; the accumulated catalog contained 86 games and four imported albums. No album link was present on that sampled HMS page. The existing confirmed-player query returned 27 players. Refreshing the first pilot album loaded 32 photos from its saved link and preserved its **26 confirmed photos before and after**. The refresh reported `albumSource=saved-link`; its link is not falsely attributed to HMS. The build made **zero image-model calls** and made no real photo-confirmation decisions.

Verified Preview configuration limits: EUCHL has an HMS connection but lacks `HMS_EUCHL_OPERATIONS_SECRET`; YHG, FLLH, POLICE and BNHLH do not have a complete HMS connection in this Preview. These organizations are implemented but not claimed live-verified. No secrets were exported, changed or copied from PHM to another organization. No main update, merge to main or Production deployment was performed. Consumer code was integrated with the current main in the isolated work branch; PR #61 remains a draft.

Configuration, synchronization bounds, storage and consumer behavior are documented in [PHOTO-PICKER.md](../docs/PHOTO-PICKER.md). The implementation does not promise automatic discovery of an album absent from HMS, unattended synchronization, or a verified monthly AI spending cap.
