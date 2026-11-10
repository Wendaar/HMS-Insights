# HMS Flickr Album field — verified API limitation

Read-only check on 2026-11-10, using the existing HMS Insights integration token:

- Game: Golden Renegades × Berkut Praha, 2026-11-09.
- Game ID: `F62DABCB-98CA-11F1-8BDF-EF2495D048F3`.
- Editor screenshot supplied by the user shows **Flickr Album** populated with `https://flic.kr/s/aHBqjDakpE`.
- `GET https://public-api.prod.hms.wootera.net/api/v1/game?gameId=F62DABCB-98CA-11F1-8BDF-EF2495D048F3` succeeds and returns game identity, organization, team IDs, name, dates, jersey colors and other sporting fields, but no property containing `flickr` or `album`.
- The organization-scoped `/games` response also omits all Flickr/album properties. Range `from=2026-10-01&to=2026-11-10&status=ALL&limit=20&skip=100` does return games dated 2026-10-24 through 2026-10-20: the source has older games; the earlier UI was not completing pagination after custom range changes.
- Public `/public/gameMultimedia` provides static images and YouTube URL for this game, without the original album link. The application can resolve the album from verified image membership, but that is distinct from reading the editor field.

Upstream request: include `flickrAlbum` in the integration API v1 game/list projection, or document the supported endpoint/permission for reading this field with the existing integration token. Preserve null/empty values for games without an album. No claim is made about the internal cause (projection, permissions or another endpoint).

The application already accepts the direct `flickrAlbum` property and distinguishes omitted versus empty. No secrets or authorization headers are included in this report. Diagnostic Preview build: `dpl_ESgrrMFvifBrP8TSvDEtyjZhQAoq`, commit `9d618f83362eb87675a0ce2091f8d3b24cd277af`.
