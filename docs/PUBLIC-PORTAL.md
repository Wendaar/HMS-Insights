# HMS League / Tournament Navigation

Public hub: `/league/<organization>`. Management: `/control/apps/public-portal?org=<organization>`; listed in Control Centre map and inventory.

The portal lives in the existing HMS application. Game Center, Insights and Team Comparison are the existing central routes, embedded without copying their implementation. HMS rules/statistics use the original embeds. No domain changes are required for testing.

## Configuration and publication

Organization registry, server API token and organization tools admin code are reused. The code is held in browser memory and sent in Authorization headers, never in links or local storage. `DATABASE_URL` enables existing `hms_tool_instances` storage, keyed by tool, organization and `main`. Only `VERCEL_ENV=production` uses tool `public-portal`; preview/development/unknown environments use `public-portal-preview`, so preview publication cannot overwrite production portal settings.

Select explicit seasons, default season, title, description, optional logo, color, language, navigation order/visibility and Extras HTML. Save a draft, inspect the protected preview, then publish. Publication freezes configuration, while HMS data and shared modules remain live. Later draft edits do not affect public output. Pause removes the published snapshot; revisions protect against concurrent editors. Public requests require published configuration and check season and section membership before reading content. These switches control this portal, not the availability of independent HMS public endpoints.

Every organization has one portal; each competition/season is directly shareable through `seasonId` and `section`. Only seasons owned by that organization can be saved or published. Unknown organizations never fall back to PHM. No portal is automatically published by deploying application code.

## Data coverage in this version

- Competition/season identity comes from organization-scoped imported HMS game metadata; competition ID is distinct from season/group/phase ID.
- Teams, venues and the group/phase overview come from imported games. Their coverage limitation is visible in public views; this is not yet a complete registration/venue catalog.
- Team logos and sponsors reuse the verified HMS organization sponsor/team catalog, projected to public fields only. Team/group/phase/venue-specific partners are not silently promoted to global partners.
- Rule embeds receive the selected season ID. Standings/player/goalie embeds receive competition ID and season ID; the current public HMS client was inspected and initializes these views from seasonId. The disciplinary embed reads competitionId only; a visible notice identifies it as competition-wide.
- Insights retains the central application's organization-wide public selection of up to 30. It does not claim season filtering.
- Group phases are listed without invented advancement rules, bracket connections or unsupported team assignments.
- Hidden portal sections return 404 from its content API, including Extras. Published Extras use a separate sandboxed HTML response, allowing custom HTTPS scripts without same-origin access to the portal. Draft preview renders HTML only; its notice explains that custom scripts run on the published Extras page. No raw HMS records, contact information, tokens or draft Extras are returned by public configuration.

## Remaining rollout work

Verify browser behavior of the live embeds, complete source catalog coverage, organization logos and full venue details against HMS capabilities. Select the final HMS domain after the pilot; paths are relative and remain portable. Additional standalone competition branding and custom domains can follow without cloning the central modules.
