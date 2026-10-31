# Future private media storage · reference design

Current delivery: [Media Mapping](MEDIA-MAPPING.md) implements GitHub-hosted audio plus centrally published PostgreSQL mappings for organizations, teams, matches and HMS sponsors. The user chose a prepared repository workflow instead of venue uploads. No Blob bucket or new subscription is needed for that delivery. The private-object-storage design below is a future option, not the current runtime.

## Decision

The implemented choice is the existing HMS Insights PostgreSQL/Neon database for published mappings and GitHub/Vercel static files for prepared audio. If private self-service uploads become necessary later, migrate file delivery to a **private Vercel Blob store**. Keep HMS as the authority for organization, team, match, lineup and official stars. The following tables and workflow describe that possible future migration; use MEDIA-MAPPING.md for the shipped schema/behavior.

Uploading MP3/WAV into PostgreSQL is unnecessary. Filename conventions, team names and public Drive-folder paths are not identities. Every attachment receives an application asset UUID; bindings use the organization and HMS team UUID. Renaming files or teams does not change a binding.

| Data | Source of truth | Reason |
| --- | --- | --- |
| Organizations, teams, matches, roster, jerseys, scores, events, official GameStars | HMS, read-only integration | Existing sporting authority |
| MP3/WAV/mixes, horns, sponsor spots | Private object storage | File delivery separate from relational data |
| Asset title, object key, MIME, size, duration, checksum, revision, uploader and timestamps | Insights DB | Search, validation, versioning and audit |
| Team/organization cue assignments | Insights DB | Explicit bindings through HMS UUIDs |
| Playlist order, per-track start/end, volume, transitions and repeat policy | Insights DB | Structured settings rather than a special filename |
| AD labels, sponsor references and spot order | Insights DB | AD 1 is display order; stable spot UUID owns the audio |
| Voice preferences and Czech pronunciation dictionary | Insights DB, optional device override | Consistent team/player names across venues |
| Device volume/output choice and last local download cache | Browser/device | Hardware-specific operation |
| Played/skipped event ledger | Local browser initially; shared session later | Shared session needs an operator/lease policy to prevent duplicate announcements |

## Proposed tables and boundaries

These are contracts for a later implementation, not installed tables:

- `show_assets`: asset UUID, owner organization UUID (nullable only for explicitly curated common assets), storage provider/key, display name, content type, byte length, duration, checksum, revision, availability and provenance/license note.
- `show_playlists` and `show_playlist_items`: organization, stable playlist UUID and revision; ordered asset references and playback settings.
- `show_cue_bindings`: organization UUID, scope (`team` or `organization`), optional HMS team UUID, cue kind (`pregame`, `puckdrop`, `goal`, `powerplay`, `ingame`, `victory`), playlist UUID and revision. Unique key over organization/scope/team/cue.
- `show_ad_spots`: organization UUID, stable spot UUID, display order, sponsor HMS ID if available, display-name override, playlist UUID and enabled flag. Reordering AD 2 to AD 1 preserves the spot UUID.
- `show_library_revisions` or an append-only audit table: who changed which assignment and its previous revision. Writes use optimistic concurrency, following the existing `hms_tool_instances` revision pattern.

Use exact organization IDs on every read/write. A team binding must refer to a team owned by that organization. A common asset is usable only after explicit curation and publication into the shared library; missing configuration never exposes another organization's private assets. The fallback is **team → organization → curated shared default → silent**. Current browser-only default remains isolated per organization until this service exists.

## Operator workflow

1. An authorized organization manager opens a central Library, uploads an owned/licensed file once and assigns it to a team/cue or an AD spot. Another operator can select the same item on any computer. Timekeepers need playback rights, not library-edit rights.
2. Upload authorization is issued after organization access and file-budget validation. Upload directly to private storage, then finalize a verified asset record; keep incomplete uploads unavailable and clean them separately. Verify MIME/content, size, media duration/decodability and checksum server-side. Do not reuse the HMS API token as a browser/admin credential.
3. Selecting a match resolves the exact two teams, organization defaults and available AD spots into a versioned manifest. A status says whether each item is downloaded, missing or cannot be decoded. The operator can preflight all cues before puck drop.
4. Playback gets a short-lived authorized media URL or a same-origin authenticated streaming endpoint with byte-range support. Browser-facing URLs never contain storage write tokens. Do not expose the entire bucket or make an HMS attachment public.
5. Cache the selected manifest and permitted media locally with an explicit byte limit and expiry. On network loss, only cached sounds play, with a visible offline status. Refresh updates versions at a safe moment; it never replaces a currently playing file. Two PCs playing independently remain independent outputs until an explicit shared operator session is introduced.

Planned API shapes: GET manifest by organization+game, authorized library asset/playlist CRUD with expected revision, authorized upload/finalize, and authorized media delivery. They do not exist in the present MVP. Admin identity and playback access must follow a deliberate organization-role design; the existing public read-only sporting endpoints are not sufficient authorization for managing a private audio library.

## Google Drive and HMS attachments

GitHub remains suitable for code and a small fixed set of owned/licensed default jingles bundled into a deployment. This checkout currently has no tracked MP3/WAV/OGG/M4A files. An evolving user-uploaded library should not require repository-write credentials, create permanent binary history and trigger a deployment for every replacement. Keep app uploads in object storage and assignments in PostgreSQL. A hybrid of bundled generic defaults plus centrally uploaded team/sponsor media is compatible with the proposed manifest. Repository limits are documented in [GitHub's large-files guidance](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

Drive can be an optional **import source**: select a file through a connected/authorized Drive workflow, copy it into the controlled audio store, then map its application UUID. If retaining a Drive source reference, keep the file ID and imported revision, not the visible name. It adds a separate permission and transfer flow; it should not be a runtime dependency for pressing GOAL during a match.

HMS attachments can become another import source if HMS later exposes stable file IDs and dedicated typed relationships. A future native `team.audioProfileId` field could point to this catalog. There is no need to wait for it or encode cue behavior into attachment filenames now.

## Next delivery

Provision the chosen private store and connect it to the existing deployment; confirm the organization admin/playback identity mechanism; implement the catalog/mappings and authorized upload/media path; then migrate local files through an explicit import. Until that is delivered, the UI must continue to say “saved in this browser,” not “shared.”

Primary references: [Vercel Blob](https://vercel.com/docs/vercel-blob), [private storage](https://vercel.com/docs/vercel-blob/private-storage), [Google Drive download/export API](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
