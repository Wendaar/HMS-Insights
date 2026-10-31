# Audio in GitHub

Upload owned/licensed MP3, WAV, OGG, M4A, AAC, FLAC or WEBM (max 30 MB each):

- `shared/` — general sounds available to every configured organization.
- `phm/` — PHM-only catalog; use the organization's registered slug for other leagues (e.g. `euchl/`).

Nested folders are allowed. Filenames do not determine team/cue assignments. Every Vercel deployment scans these folders automatically; assign files in `/studio/media-mapping` after deployment. Replacing a file at the same path preserves its mapping ID and changes its checksum/version. Renaming creates a new file identity; update mappings before deleting the previous path.

GitHub-hosted media are public static assets. Organization catalog filtering does not make a file URL private. Do not upload confidential or unlicensed files.

`shared/test-tone.wav` is an original, quiet synthetic three-tone test signal generated for this project, not a music recording. Nothing plays automatically or is assigned until a manager publishes a mapping.
