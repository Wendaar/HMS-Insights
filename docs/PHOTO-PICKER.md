# Shared person photo picker and organization archives

The implementation remains in the pilot Preview, on `codex/hms-photo-archive-pilot` (PR #61). No production enablement, HMS writes or main update is part of this change.

## Sources and consumers

`public/photo-picker/picker.js` opens the same dialog in All Stars, Social Media Studio (including individual Insights and official-star graphics), and Broadcast Studio. The order is HMS profile, confirmed archive photographs for the exact organization/player ID, then a local upload. Selecting a photo changes the graphic, not the HMS profile. Image URLs are validated by the shared model; archive access requires that organization's Operations session/code. A PHM session never authorizes another organization.

- All Stars: the **Fotografie** button is under **Upravit vybrané hráče**. Choices survive local restoration and JSON export/import, are validated when saving, and enter the frozen published lineup. The server verifies archive photo ID and URL against the exact player's confirmed links in that organization. Own uploads are decoded and resized to JPEG (maximum 512px longest edge, 180,000 characters per image); six choices fit the bounded 1.2MB save payload. Publication still requires the existing authorized manual publication flow.
- Social Media Studio: **Vybrat fotografii · HMS / archiv / nahrát** appears for an individual subject. Selection is bound to organization, game and player; it is passed through the existing canvas/image loader into the PNG. Team-only graphics do not pretend to have a person avatar.
- Broadcast: select a player in the new photo section. Overrides apply consistently to that player's roster/scorer/individual-performance image within the selected game. At most six replacements are stored per game/channel. The existing protected permanent OBS channel transports the selected references or resized upload; the overlay validates channel organization and game before applying them. A standalone copied URL does not carry upload data or device preferences to another machine: use the permanent OBS channel for that. The public channel exposes only the selected output, never the private archive listing or management key.

The dialog never sends the Operations code to Flickr or stores it in localStorage. Reusing an existing Operations session does not require entering the code again. The picker itself makes no AI calls.

## Organization catalog and albums

`/photo-archive?org=<slug>` offers the organization registry. A configured organization uses only its `HMS_<CODE>_ORGANIZATION_ID`, `HMS_<CODE>_API_TOKEN` and `HMS_<CODE>_OPERATIONS_SECRET`; PHM retains its existing HMS token compatibility. Organization IDs, API tokens and codes remain server-side. Missing configurations are explicit, without borrowing PHM credentials.

On opening the authorized workspace, discovery checks the last fourteen Prague-calendar days, in pages of twenty games. Up to five pages are advanced automatically; **Dalších 20 zápasů** continues when more remain. Date inputs allow a bounded range of at most a year. Refreshing discovery preserves previous catalog entries and review decisions. It is browser-triggered synchronization, not an unattended scheduled worker.

HMS detail is checked for game/organization ownership. An album link can come from the game or `gameMultimedia`; optional public metadata is read without an API token and matched by team identities/date (and any supplied game ID). Some actual HMS games do not expose a Flickr link. Their existing saved pilot links remain valid, and **Připojit album k vybranému zápasu** attaches a validated URL to the archive's catalog after ownership verification. This does not write back to HMS. The system does not guess an album from team names or use one organization's Flickr owner for another organization. Original photo links use Flickr photo IDs rather than the former fixed owner.

Opening a new linked album imports its metadata and verified lineup, without AI spending. Imports merge existing decisions and analysis cache. **Načíst dalších 250 fotek** continues larger albums. The current image-model queue still handles at most 250 new/upgraded images per run; another explicit run processes the rest.

Album states are new / in progress / reviewed / closed, with games lacking albums shown separately. **Ověřené** is an explicit reviewer marker; **Uzavřené** additionally requires all loaded photos resolved and the full album inventory loaded. Resetting a photo to pending or draft reopens its album. Importing new photos also reopens it while preserving earlier confirmed links. HMS discovery notices changed album links; detecting additional photos inside the same Flickr album requires refreshing that album's metadata.

## Storage and boundaries

The existing `hms_tool_instances` namespace `photo-archive-preview` is retained. Organization is part of every key. Discovered games live in that organization's `catalog` row, while game rows retain review/AI state. The confirmed-player query filters organization and player in SQL rather than loading all game inventories into every photo picker. Source portraits and sporting facts are not modified.

The Preview still requires the branch guard. Generalization does not by itself make the feature available on production domains or configure another organization's credentials. Real goalkeeper recognition accuracy, universal cache invalidation and an enforced monthly image-model spend cap remain outside the verified scope.
