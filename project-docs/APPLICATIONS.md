# Application index — where Codex should look

Last reviewed: 2026-11-10. This is a **navigation index**, not a guarantee that every tool is fully deployed. Check the actual code, links and configuration before claiming readiness.

| Area / tool | Read first | Notes |
| --- | --- | --- |
| Control Center / application map | [CONTROL-CENTER](../docs/CONTROL-CENTER.md) | Shared app registry under `public/control/registry.js`; PHM and HERO domains share implementation. |
| Media / Social Studio | [MEDIA-STUDIO](../docs/MEDIA-STUDIO.md), [STUDIO-ORGANIZATIONS](../docs/STUDIO-ORGANIZATIONS.md) | Games, insights, editing/export flows; maintain organisation/language scoping. |
| Game Center / game reports | [GAME-CENTER](../docs/GAME-CENTER.md) | Read existing GameSummary and event pipeline before changing report logic. |
| Insights / Příklepy / archive | [INSIGHT-TYPES](../docs/INSIGHT-TYPES.md), [PRIKLEPY-ROADMAP](../docs/PRIKLEPY-ROADMAP.md) | Distinguish current rules from roadmap ideas. |
| Sponsors | [SPONSOR-LAYER](../docs/SPONSOR-LAYER.md) | Shared HMS sponsor data; distinguish original assets, crops and placements. |
| Broadcast / OBS | [BROADCAST](../docs/BROADCAST.md), [MEDIA-MAPPING](../docs/MEDIA-MAPPING.md) | Avoid breaking browser-source URLs or published media mappings. |
| Live Show Control | [SHOW-CONTROL](../docs/SHOW-CONTROL.md), [SHOW-CONTROL-LIBRARY](../docs/SHOW-CONTROL-LIBRARY.md) | Audio, TTS and match events; existing public aliases must continue working. |
| Game Day / match reminders | [GAME-DAY](../docs/GAME-DAY.md) | Differentiate social preview output from team-specific reminder delivery. |
| Registrations | [REGISTRATIONS](../docs/REGISTRATIONS.md) | Access controls matter: registration/payment data can include personal information. |
| Operations / staff and finance views | [OPERATIONS](../docs/OPERATIONS.md) | Explicit permissions, per-organisation rules and payment side separation. |
| All Stars | [ALL-STARS](../docs/ALL-STARS.md) | Check API beta versus historical sheet-based generator. |
| Team comparison | [TEAM-COMPARISON](../docs/TEAM-COMPARISON.md) | Organisation-scoped comparison tooling. |
| Playoff players | [PLAYOFF-PLAYERS](../docs/PLAYOFF-PLAYERS.md) | Existing configuration/public output. |
| Photo tools / archive | [PHOTO-PICKER](../docs/PHOTO-PICKER.md), [HMS-FLICKR-API](../docs/HMS-FLICKR-API.md), `photo-archive/` | Verify photo archive implementation state from files; do not assume production readiness. |
| Virtual Camera | [VIRTUAL-CAMERA](../docs/VIRTUAL-CAMERA.md) | Camera signalling/control is independent of a specific HMS game. |
| Public portal / embeds | [PUBLIC-PORTAL](../docs/PUBLIC-PORTAL.md), [GAMES-EMBED](../docs/GAMES-EMBED.md) | Check iframe, routing and CORS/security behaviour before modifying. |
| Organisational configuration | [STUDIO-ORGANIZATIONS](../docs/STUDIO-ORGANIZATIONS.md) | Never infer organisation identifiers from names or substitute PHM credentials. |

## Cross-cutting references
- `README.md` — repository purpose and common commands.
- `VERCEL_SETUP.md`, `vercel.json` — deployment and routes.
- `public/organization-catalog.js`, `src/app/organizations.js` — organisation catalog/registry described in the feature documentation.
- `src/`, `api/`, `public/`, `test/` — verify behaviour here before editing.

## Scope convention for each new task
Use a fresh Codex task for a distinct feature or bug. Provide: **Outcome**, **Context** (links to 1–3 relevant docs), **In scope**, **Out of scope**, **Acceptance criteria**. Do not paste entire previous chat logs. At completion, update only documentation affected by the implemented change.

## Documentation hygiene
This directory (`project-docs/`) is for developer reference. The existing `docs/` directory may also serve static demo content; avoid moving or replacing assets there without checking build scripts.
