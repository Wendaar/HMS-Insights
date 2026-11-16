# HMS / Vercel architecture audit — 2026-11-17

**Status:** AUDIT ONLY; proposal, not implementation. **Scope:** `Wendaar/HMS-Insights` default branch, selected implementation files and existing `docs/` documents. No infrastructure changes, deployment, schema migration, or production write. The original request is `HMS Architecture & Vercel Optimization`.

## Executive decision

**Do not split into eight Vercel projects in one operation.** Start with **five or six bounded deployable domains**, while preserving the one-repository shared source of truth:

1. **HMS Core / Insights + Games + Reports** (initially existing `hms-insights`, kept unchanged for backward compatibility).
2. **HMS Public**: portal, site builder, widgets and public embeds; separate only after the route/iframe contract is tested.
3. **HMS Studio**: social graphics, game-day and related media generation.
4. **HMS Broadcast**: OBS overlays and persistent channels; sponsor and mapping dependencies require explicit boundaries.
5. **HMS Game Show**: show control / sound and media mapping where shared media makes this appropriate; validate actual ownership before extraction.
6. **HMS Virtual Camera**: isolate as the first experimental candidate because its control plane has unusually intensive polling.

**Photo Archive is a candidate for a seventh project only if independent batch processing, cost, or deployments justify it.** Registrations, reminder crons, tools, sponsor administration, and other utility functions must have an assigned owner rather than disappearing from the inventory. Independent projects in **one Vercel team still share team billing limits**; project isolation addresses deployment risk and visibility but does not guarantee fault isolation from shared Neon, HMS APIs, or shared account-level restrictions.

## Evidence checked (repository paths)

- `package.json`: Node >=20, `@neondatabase/serverless`, `@vercel/blob`, `esbuild`; scripts `build:media`, `build:static`, `test`, `start`.
- `vercel.json`: a single deployment configuration, `fra1` region, `node scripts/build-media-client.js` build, cron `/api/cron/reminders` at 06:15 and `/api/cron/pregame-rankings` at 23:00; numerous redirects, CSP headers and path rewrites.
- `api/game-summary.js`: shared entrypoint imports and instantiates widgets, virtual camera, photo archive, match preview, media mapping, game day, registrations, sponsors, public portal, team comparison, pregame rankings, all stars, operations, season games, broadcast, studio image, studio, extras, player card and summary handlers. Comment explicitly explains prior bundling to fit a Hobby function count; Pro removes that original architectural motivation but not the need for controlled refactoring.
- `public/virtual-camera/app.js`: OBS output polls GET state at 250 ms **after the prior response**, controller POST heartbeat every 2000 ms, output POST status report every 2000 ms, and conditional dirty-state flush check every 180 ms. A flush interval is not itself a request if no dirty state exists.
- `src/web/virtual-camera-handler.js`: Neon `DATABASE_URL`, production table `hero_camera_sessions` vs preview `hero_camera_sessions_preview`, read-hash/edit-hash separation and revision checks; every state read selects from SQL; heartbeat and report update SQL.
- `docs/VIRTUAL-CAMERA.md`: VDO.Ninja WebRTC carries the video directly to clients; Vercel carries only small control/status JSON; 8s fallback to wide view; existing links contain session capability keys in fragments. Migrating to a new origin is not a trivial rewrite.
- `public/broadcast/app.js`: Broadcast frontend has explicit `API_BASE`; a fallback hard-codes `https://hms-insights-five.vercel.app/api/broadcast`. This is a migration trap requiring same-origin and host-specific checks.
- `docs/BROADCAST.md`: broadcast control channels persist in `broadcast_channels` under `DATABASE_URL`; public channel polls state approximately every 2 seconds and live match layers refresh approximately every 15 seconds. There is a source-sync workflow from `Wendaar/Youtube-Overlays` — avoid editing generated copies blindly.
- `docs/MEDIA-STUDIO.md`: `/studio` shares normalized game engine and snapshots; source reads coalesce in instance-local cache; API tokens scoped per organization; unconfigured organizations must not fall back to PHM.
- `docs/GAME-CENTER.md`: Game Summary v1, finished-only importer and game-report contract, transactional snapshot and event history; today/live polling documented as pause-on-hidden/offline and exponential backoff.
- `docs/PUBLIC-PORTAL.md`: portal publication/draft stores, portal admin secrets, `VERCEL_ENV` segregation and public embeds. `public.heromanagementsystem.com` currently attached to existing Vercel project.
- `docs/CONTROL-CENTER.md`: same Control Center implementation used for `app.phmcup.cz/control` and HERO host; `public/control/registry.js` and `public/control/map.js` hold navigation metadata. Origin-local browser state is separate.

**Audit limitations:** GitHub connector was used to inspect selected source paths and documentation, not a cloned full-tree build. No live Vercel per-route analytics, Neon query stats, domain dashboard, secrets, source-controlled full file inventory, real OBS or end-to-end tests were available in this audit. Paths for Photo Archive and Show Control are evidenced by rewrites and handler references, but their entire implementations have **not** been recursively reviewed. No authoritative numeric per-app traffic attribution is possible yet. This document is an evidence-based preliminary architecture audit; the first execution task below is to complete its inventory before deciding on production migration.

## Service ownership and dependency map

| Domain / functions | Verified entrypoints or API | Dependencies and important contracts | Initial target |
| --- | --- | --- | --- |
| Core Insights / Archive | `/priklepy`, `/priklepy/:org`, `/archiv`, `/archiv/:org`, `/api/page`, `/api/archive-page` | finished-only ingestion, normalized snapshots, Neon, organization isolation, public SEO links | core |
| Games and Game Report | `/games/...`, `/game-center/:gameId`, `/api/games`, `/api/game-summary`, `/api/game-report-page` | HMS API, normalized source engine, public result/report contract, schema compatibility | core initially; review later |
| Social / Media Studio | `/studio`, `/studio/:org`, `/api/studio`, `/api/studio-image`, `/api/game-day` | HMS org API tokens, shared game engine, graphics and sponsor assets, media build | studio |
| Broadcast | `/broadcast/...`, `/api/broadcast`, `/sponsors`, `/api/sponsors`, `/media-mapping` | OBS overlays, DB channels, sponsor/media catalog, generated frontend copy, HMS tokens | broadcast |
| Public Portal / Widgets | `/league/:org`, `/widgets/...`, `/api/portal`, `/api/widgets`, `/control/apps/public-portal` | published config and drafts in Neon, CSP/iframe, domain-specific root, HMS embeds | public |
| Game Show / media | `/show-control`, `/api/media-mapping`, Blob media catalog | audio assets, Vercel Blob and access controls; exact ownership to confirm | show |
| Virtual Camera | `/virtual-camera`, `/virtual-camera/output`, `/api/virtual-camera` | direct VDO WebRTC, Neon session state, OBS output, fragment bearer keys | camera first |
| Photo Archive | `/photo-archive`, `/api/photo-archive` | photo archive handler, Flickr media, HMS roster, storage; throughput unmeasured | core initially; optional separate |
| Registrations | `/registrations`, `/api/registrations`, `/control/apps/registrations` | sensitive team access, authorization and privacy; private/no-store | core/admin until reviewed |
| Other utilities | `/all-stars`, `/team-comparison`, `/operations`, `/tools/playoff-players`, match preview, cron reminders and rankings | org tokens, shared storage, periodic jobs, partner data | assign in full inventory |
| Control Center | `/control`, `/control/registry.js`, `/control/map.js` | navigation across all apps, two current origins, browser origin storage | shared launcher (static) |

**Current traffic topology:** most API labels rewrite in `vercel.json` to `/api/game-summary?view=...`, so separate frontend folders are **not** separate serverless deployables. Under a split, routing must cover both pages and their same-origin APIs/assets and keep cross-organization and preview protections.

## Request diagnosis, carefully separating measurements from estimates

Source-code estimates for **one constantly connected session**:

| Activity | Source cadence | Approximate requests per 24h | Note |
| --- | --- | ---: | --- |
| Camera OBS GET state | 250 ms after each response | **up to ~345,600** | latency makes actual frequency lower; not measured |
| Camera OBS POST report | 2 seconds | **~43,200** | plus SQL UPDATE |
| Camera controller POST heartbeat | 2 seconds | **~43,200** | plus SQL UPDATE |
| Camera movement PUT state | only if dirty, flush check 180ms | highly variable | do **not** treat check frequency as requests |
| Broadcast channel read | ~2 seconds | ~43,200 | only while output is open |
| Live broadcast layer refresh | ~15 seconds | ~5,760 | if continuous; independent channel behavior varies |

One continuous camera OBS output alone could therefore theoretically create roughly **389,000 HTTP requests per day** combining GET and report, before operator heartbeat and write updates. This is a code-derived upper estimate, **not evidence** it actually caused the Vercel limit. At a 250 ms polling cadence 30 continuous days can exceed 10M requests; thus Pro is breathing room, not a permanent fix if sessions stay open. Browser/OBS runtime, throttling, uptime, network latency and retries change totals.

**Prior user-supplied Vercel dashboard:** 1,022,032 CDN/Edge requests versus 1M Hobby quota, ~668k function invocations, ~2h58 compute, 3.37GB transfer. No per-path historical attribution was supplied. The app-side simulated request figures are not measured production shares.

Other suspected areas: Broadcast active channel poll, finished-game refresh, hidden-tab activity in utilities, failed request retry loops, and shared hard-coded production URL. Verify them, do not assume a new defect where documentation already specifies visibility pausing, bounded caching or coalescing. Vercel cached edge hits can still count toward request quotas.

**Preferred camera design discovery:** benchmark a push/subscription control channel or specialized real-time provider, with clear auth and cost comparison. Preserve session IDs, read/edit key separation, revision conflict semantics and fallback-to-wide freshness. Long-lived WebSocket hosting is not assumed to work on ordinary Vercel Functions. Do not substitute slow polling merely to make request charts look better. Test interactive pan/zoom latency, disconnect/reconnect, stale-state fallback and one or more simultaneously controlled outputs before approving any change.

## Proposed staged implementation (not authorized in this PR)

| Stage | Safe deliverable and explicit gate | Effort | Regression risk |
| --- | --- | --- | --- |
| 0. Complete inventory | automated route + file matrix from full checkout, enumerate `api/`, `public/`, `src/web/`, `docs/`, cron/auth/db tables/secrets names, Vercel Project settings and traffic baseline; no code change | S–M | Low |
| 1. Baseline tests | fixtures and smoke tests for each route, org, auth, embed, OBS channels; capture current `main` commit SHA and reversible deployment state | M | Low |
| 2. Camera research/prototype | compare current polling with read-only instrumentation and isolated preview for realtime protocol, latency and requests; preserve data tables and URLs | M–L | Medium–high |
| 3. Extract Virtual Camera | independent build/API and preview project, separate deployment triggers; preserve session state with explicit secrets/table/env mapping; test fallback and URL routing | L | High |
| 4. Extract Broadcast | independent frontend/handler, channel persistence, sponsor/media dependencies and hardcoded host removal; OBS browser test and rollback | L | High |
| 5. Extract Studio / Show Control | per-domain builds, imported shared models and Blob; verify PNG export and audio catalog on PHM and EUCHL | M–L | Medium |
| 6. Extract Public Portal | publish workflow, `/league`, widgets, domain-specific root, CSP/frame-ancestors, Webnode and PHM embeds; URL parity | L | Very high |
| 7. Review remaining split | only if warranted: Games vs Insights; Photo Archive batch; registrations/utilities and background jobs; settle at 5–7 projects | M–L | Medium–high |
| 8. Production cutover per service | preview health check, no-merge deployment freeze for affected service, canary route, monitoring and rollback, verify in real browser/OBS | M per service | High |

Relative effort: **S** = contained review/doc; **M** = multiple modules and tests; **L** = architecture change plus integration/production verification. These are **not** model-credit, engineering-hour, or dollar forecasts. Work must be broken into separate PRs and acceptance gates.

### Non-negotiable validation before each cutover

1. Save last-known-good commit and deployment IDs, plus exact reverse-routing operation; retain old deployment until validation completes.
2. Record old/new route matrix including `app.phmcup.cz`, `public.heromanagementsystem.com`, Vercel-host aliases, legacy links, embeds, OBS URLs, API paths, static assets, redirects and CSP.
3. Confirm same-origin API and CORS, Authorization headers, fragment URL keys, browser localStorage scope, Webnode iframe embedding, tenant scoping, and that preview cannot write production config.
4. Confirm DB owner, schema/table access and durable state (especially `broadcast_channels`, `hero_camera_sessions`, published portal config), no data migrations by assumption. Backups before any later stateful change.
5. Run `npm test` plus targeted browser checks; record cases not executable without real OBS, HMS or production credentials as **unverified**, not passed.
6. Canary test read and write workflows under real domains before moving all paths; compare HTTP status/headers, screenshots and live outputs.
7. Monitor errors, count of edge/function requests, DB query rate, latency and billing for at least a representative active broadcast session and ordinary off-hours operation; reverse route on failure.
8. Test a deployment touching only Camera and demonstrate that it does **not** rebuild/deploy Insights; repeat for Studio vs Broadcast.

A simple reverse proxy to independent backend projects may preserve existing links yet still make the gateway a shared outage point and count requests against its team. Document that tradeoff, prefer stable routing boundaries and avoid claiming complete isolation.

## Rules for future apps

Create or extend `docs/NEW-APP-CHECKLIST.md` when implementation begins; until then use this decision rule:

- If a feature shares product purpose, auth, lifecycle and release schedule with an existing service, add it there.
- If it has independent streaming/realtime requirements, sharply different throughput, sensitive privileges or a different outage blast radius, propose a new project.
- Every proposal must identify owner, URLs, API requests, org isolation, storage/credentials, refresh cadence, observable metrics, dependencies, build scope, smoke tests, rollback and estimated service cost.
- Do **not** use Hobby accounts to multiply free quotas for commercial production; keep a coherent Pro organization and consider separate billing/team isolation only after usage and criticality warrant it.

## Next action

**Do not merge an implementation PR yet.** Review this architecture draft, then execute stage 0/1 as a self-contained follow-up; request export of Vercel Usage broken down by project/path/time if available and Neon usage/query telemetry. Decision gate: confirm the actual project count and first migration candidate after the complete source inventory and empirical load baseline.

