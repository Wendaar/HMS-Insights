import {sportingImage} from '../../public/game-report-media.js';
import {venueBackground} from '../../public/venue-media.js';
const image=e=>sportingImage(e?.logoUrls?.md??e?.imageUrls?.md??e?.logoUrl??e?.avatarUrl);
// Same hierarchy as the normalizer, with sporting media allowlisted centrally.
export function hmsMediaContext(detail={}) {
  const phase=detail.Phase,group=detail.Group??phase?.Group,season=detail.Season??group?.Season;
  const competition=detail.Competition??season?.Competition;
  return {competitionLogoUrl:image(competition),seasonLogoUrl:image(season),groupLogoUrl:image(group),phaseLogoUrl:image(phase),
    venueLogoUrl:image(detail.Venue),venueBackgroundUrl:venueBackground(detail.Venue?.backgroundImageUrl??detail.Venue?.backgroundImageUrlForInfographics??detail.Venue?.infographicsBackgroundImageUrl),
    organizationLogoUrl:image(detail.Organization??competition?.Organization),competitionName:competition?.name??null,groupName:group?.name??null,phaseName:phase?.name??null};
}
