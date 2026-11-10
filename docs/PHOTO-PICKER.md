# Shared person photo picker and organization archives

The archive is enabled on production and the pilot Preview. PR #61 includes the shared picker and organization catalog. All data synchronization reads HMS; photo review and catalog changes are stored in the application's database, never in HMS.

## Sources and consumers

`public/photo-picker/picker.js` opens the same dialog in All Stars, Social Media Studio (including individual Insights and official-star graphics), and Broadcast Studio. The order is HMS profile, confirmed archive photographs for the exact organization/player ID, then a local upload. Selecting a photo changes the graphic, not the HMS profile. Image URLs are validated by the shared model; archive access requires that organization's Operations session/code. A PHM session never authorizes another organization.

- All Stars: the **Fotografie** button is under **Upravit vybrané hráče**. Choices survive local restoration and JSON export/import, are validated when saving, and enter the frozen published lineup. The server verifies archive photo ID and URL against the exact player's confirmed links in that organization. Own uploads are decoded and resized to JPEG (maximum 512px longest edge, 180,000 characters per image); six choices fit the bounded 1.2MB save payload. Publication still requires the existing authorized manual publication flow.
- Social Media Studio: **Vybrat fotografii · HMS / archiv / nahrát** appears for an individual subject. Selection is bound to organization, game and player; it is passed through the existing canvas/image loader into the PNG. Team-only graphics do not pretend to have a person avatar.
- Broadcast: select a player in the new photo section. Overrides apply consistently to that player's roster/scorer/individual-performance image within the selected game. At most six replacements are stored per game/channel. The existing protected permanent OBS channel transports the selected references or resized upload; the overlay validates channel organization and game before applying them. A standalone copied URL does not carry upload data or device preferences to another machine: use the permanent OBS channel for that. The public channel exposes only the selected output, never the private archive listing or management key.

The dialog never sends the Operations code to Flickr or stores it in localStorage. Reusing an existing Operations session does not require entering the code again. The picker itself makes no AI calls.

## Organization catalog and albums

`/photo-archive?org=<slug>` offers the organization registry. A configured organization uses only its `HMS_<CODE>_ORGANIZATION_ID`, `HMS_<CODE>_API_TOKEN` and `HMS_<CODE>_OPERATIONS_SECRET`; PHM retains its existing HMS token compatibility. Organization IDs, API tokens and codes remain server-side. Missing configurations are explicit, without borrowing PHM credentials.

On opening the authorized workspace, discovery checks the last fourteen Prague-calendar days, in pages of twenty games. Up to five pages are advanced automatically; **Dalších 20 zápasů** continues when more remain. Date inputs allow a bounded range of at most a year. Refreshing discovery preserves previous catalog entries and review decisions. It is browser-triggered synchronization, not an unattended scheduled worker.

HMS detail is checked for game/organization ownership. Sparse game lists are hydrated from detail and the organization's team directory. Optional public metadata is read without an API token and matched by team identities/date (and any supplied game ID). An album link can come directly from HMS; if HMS only exposes static Flickr images, the system intersects their actual Flickr album memberships and accepts one unambiguous common album with a verified photo owner. It never guesses from team names. Existing saved links remain valid; **Připojit album k vybranému zápasu** also permits manual attachment after ownership verification without changing HMS.

Opening a new linked album imports its metadata and verified lineup, without AI spending. Imports merge existing decisions and analysis cache. **Načíst dalších 250 fotek** continues larger albums. The current image-model queue still handles at most 250 new/upgraded images per run; another explicit run processes the rest.

Album states are new / in progress / reviewed / closed, with games lacking albums shown separately. **Ověřené** and **Uzavřené** are explicit reviewer decisions. An operator can close an album with pending, draft or unloaded photos; this does not approve or reject those photographs and does not add them to player archives. The audit records pending/draft/unloaded counts. Resetting a photo to pending or draft reopens its album. Importing new photos also reopens it while preserving earlier confirmed links; a partial refresh without new photos preserves the operator's closure. Detecting additional photos inside an existing Flickr album requires refreshing its metadata.

## Storage and boundaries

The existing `hms_tool_instances` namespace `photo-archive-preview` is retained. Organization is part of every key. Discovered games live in that organization's `catalog` row, while game rows retain review/AI state. The confirmed-player query filters organization and player in SQL rather than loading all game inventories into every photo picker. Source portraits and sporting facts are not modified.

Production runs on the main deployment behind the same organization-specific Operations authentication. Preview retains its pilot branch guard. Every organization needs its own HMS connection and Operations code; no credentials are borrowed from PHM. The existing `photo-archive-preview` namespace is deliberately retained to preserve reviewed links. Production uses `PHOTO_VISION_MODEL=gpt-6-luna`; API keys remain server-side. Real goalkeeper recognition accuracy, universal cache invalidation and an enforced monthly image-model spend cap remain outside the verified scope.
