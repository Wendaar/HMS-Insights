# HMS companion ecosystem — developer overview

Last reviewed: 2026-11-10. Scope: the `Wendaar/HMS-Insights` repository, **not** the entire proprietary HMS core system.

## Purpose
HERO Management System (HMS) is the source of hockey-management data. This repository hosts a growing collection of web-facing and operational companion tools: game reports, insights, social content, broadcast support, management utilities and supporting services.

**Important separation:** the HMS core platform/API is external to this repository. A feature's presence in the Control Center registry does not prove it is implemented, configured for every organisation, or live in production.

## Repository layout
- `src/`: server/domain/business logic including HMS integration.
- `api/`: API/serverless entry points.
- `public/`: client-facing tools and assets, including the Control Center.
- `docs/`: existing feature documentation **and** static GitHub Pages/demo output; treat carefully.
- `test/`: Node.js test suite.
- `db/`, `scripts/`: persistence/migrations and operational scripts.
- `photo-archive/`: photo archive work area.
- `vercel.json`: hosted routing and rewrites.

## Core operating principles
1. **Multi-organisation by design.** PHM is a common default for legacy URLs, not a universal fallback. Other organisations need their own verified identity/configuration. Keep public views, admin actions, sponsor data and imported histories isolated.
2. **Reuse existing HMS data.** Do not create a parallel source of truth for games, teams, players or sponsors without a clear reason. Verify actual API fields and access before depending on them.
3. **Read/public versus controlled actions.** A public page does not imply permission to write to HMS or expose private data. Keep secrets server-side and document access boundaries per tool.
4. **Preserve working routes.** Many tools have stable legacy paths used in embeds, OBS, organisations' websites and shared links.
5. **Independent modules, shared conventions.** Media Studio, Broadcast, Game Center, Insights, Operations and Show Control overlap in data but have distinct user flows; extend existing common logic where appropriate.

## Verified repository references
- [Control Center](../docs/CONTROL-CENTER.md): shared application registry and organisation-aware navigation; routes include `/control`. The documented PHM and HERO domain entries use one implementation.
- [Studio](../docs/MEDIA-STUDIO.md), [organisation configuration](../docs/STUDIO-ORGANIZATIONS.md): game browsing, read paths, organisation scoping and CS/EN.
- [Game Center](../docs/GAME-CENTER.md): game report and summary.
- [Sponsor layer](../docs/SPONSOR-LAYER.md): shared sponsor concerns for Social/Broadcast.
- [Show Control](../docs/SHOW-CONTROL.md), [media mapping](../docs/MEDIA-MAPPING.md): live audio/TTS and cue configuration.
- [Operations](../docs/OPERATIONS.md): scoped operations/closing workflows.
- See [APPLICATIONS.md](APPLICATIONS.md) for more features and links.

## Local development
Requires Node.js 20+ (`package.json`). Main commands: `npm start`, `npm test`; specialised scripts are listed in `package.json`. Deployment and secret configuration are described in existing docs; do not copy live secrets into this repository.

## Documentation maintenance
Keep this overview conceptual and short. The feature-specific doc and implementation should explain detailed behaviour. Record planned/experimental work as such. When code and docs differ, verify the code and update the relevant doc rather than copying chat assumptions.

## Fast-start prompt for Codex
"Read AGENTS.md and the relevant references in project-docs/APPLICATIONS.md. Implement [specific outcome]. Scope: [included changes]. Out of scope: [excluded changes]. Done when: [observable acceptance checks]. Preserve existing organisation isolation, public URLs and regressions. Report tests and any unresolved assumptions."
