Ostré adresy: [Show Control](https://public.heromanagementsystem.com/show-control?org=PHM), [Media Mapping](https://public.heromanagementsystem.com/media-mapping?org=PHM), [rozcestník](https://public.heromanagementsystem.com/control?org=phm). Staré adresy `/studio/announcer` a `/studio/media-mapping` zůstávají přesměrováním.

# Media Mapping · centralized sound assignments

Open `/studio/media-mapping` from Media Studio, Control Center or Show Control's settings. This is the shared audio mapping layer; Show Control is the playback surface. No upload is needed at the venue.

## Prepare files in GitHub

1. Use the GitHub link inside the configurator. It targets the branch serving that deployment: preview files must be committed to the preview branch; production files go through the normal main/PR workflow.
2. Upload owned/licensed MP3/WAV/OGG/M4A/AAC/FLAC/WEBM to `public/media/audio/shared/` for general availability, or `public/media/audio/phm/` (organization slug) for the organization's catalog. Subfolders and Czech filenames/spaces are supported. Limit 30 MB/file and 1,000 files. A mix is a prepared single audio file; multi-file playlist editing is not implemented.
3. Wait for Vercel's deployment to finish. `scripts/build-media-catalog.js` scans files automatically into `public/media/catalog.json`. No filename convention determines a team, sponsor or cue. Refresh the configurator and select/preview the new file.

These are public static web assets. Organization filtering is not file-URL confidentiality. Never upload confidential or unlicensed files. The bundled original `test-tone.wav` is a quiet three-note synthetic test signal and has no automatic assignment.

## Assign once, use across computers

1. Select the organization and unlock with its existing Operations code or Tools Admin access code. The code is held only in page memory, never placed in a URL or browser storage. The API accepts the existing Operations secret for the same organization as well as its Tools Admin secret (or existing webhook fallback), never an HMS API token. No credential value or other app's access configuration is changed.
2. Pick a file, choose the target and cue, set gain and whether to loop, then add the assignment. Targets: organization default, named HMS team, selected HMS match, or named HMS sponsor. Teams/sponsors reuse the existing verified sponsor/teams catalog; matches use the Studio date picker. The server independently validates ownership on save and publish.
3. Save the draft, then publish. Draft changes do not affect operators. Another editor's revision causes a 409 conflict rather than overwriting their changes. Reload the latest version and reapply the edit.
4. Select or refresh the match in Show Control. Published mappings load centrally, including on another browser/computer with no local audio uploads. A new mapping takes effect on the next cue; currently playing audio keeps its original source and stops only under operator control/end of track.

## Precedence and playback

For HOME/AWAY cues: exact match+side → match+both → actual team → organization default+side → organization default+both → legacy local test profile → silent. A sponsor cue resolves by the exact organization's HMS sponsor ID. Match overrides win over team choices; no other organization is ever substituted.

An explicitly mapped file that disappeared is shown as missing and disabled. It does not silently fall back to a different song. Generic music can be available in `shared/`, but default assignments remain separate for each organization. Sponsor and team names can change without breaking UUID bindings.

File IDs are derived from their path; replacing bytes at the same path preserves assignment identity, while the checksum changes the playback URL version. Renaming a file creates a new identity: update mappings before removing the old file.

## Central storage and environments

The existing `hms_tool_instances` store holds one `library` instance per organization, with `draft`, `published` and optimistic `revision`. Explicit production uses tool `media-mapping`; preview/local uses `media-mapping-preview`. The API reports this sandbox state; preview publications cannot replace production mappings. Existing shared PostgreSQL `DATABASE_URL` is required. No in-memory or browser-only substitute is presented as a successful central save. The existing table is created only through an authorized save, consistent with the other Tools workflows.

GET `/api/media-mapping?org=PHM`: published bindings plus the branch's organization-filtered file inventory.

GET actions `access`, `manage`, `context`; POST actions `save`, `publish`. Management requires Bearer authorization and same-host Origin when present. Bodies are limited to 100 KB and 200 bindings; each configuration can include at most 20 match overrides, validated in bounded parallel batches. Public responses contain sporting IDs and file metadata only. The API shares `api/game-summary.js` to avoid adding a serverless function.

The Vercel build command generates only the media catalog and leaves the established public directory/routing intact; only the small catalog JSON is explicitly included in function bundles. Audio files are delivered as static assets, not through database blobs or the serverless function. Local Node serves the same files for testing.

## Stadium preflight

- Confirm the GitHub upload is on the same branch/deployment as the operator panel.
- Check the editor reports central database ready and organization management configured; otherwise no central save/publication is possible.
- Publish general and team/sponsor/match assignments, then open the selected match in a second browser/device to verify the shared configuration.
- Press each required cue once, confirm loop/volume/STOP, test Czech speech over music, and check the actual PA/OBS routing.
- Venue playback needs connectivity to fetch static audio; no offline download/cache guarantee is claimed in this version. Preload/airplane-mode support is deferred.

Tests cover authorization, organization/target ownership, publication/revision conflicts, missing files, environment separation and exact precedence. Browser checks use an injected database/HMS fixture and the actual bundled WAV for native decoding. Live deployment readiness is checked separately; a real team song cannot be mapped before it is uploaded.
