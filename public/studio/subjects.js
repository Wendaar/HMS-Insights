import {t,language} from './i18n.js';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export function resolveInsightSubject(game,insight){
  if(!insight||!same(game.gameId,insight.gameId))return null;
  const legacyId=insight.id?.split(':').at(-1);
  const playerId=insight.playerId??(insight.player&&uuid(legacyId)?legacyId:null);
  const player=playerId?[...(game.players??[]),...(game.goalies??[])].find(p=>same(p.id,playerId)):null;
  const teamId=player?.teamId??insight.teamId??(!playerId&&uuid(legacyId)?legacyId:null);
  const team=[game.home,game.away].find(t=>same(t.id,teamId))??null;
  const photo=playerId?(player?.imageUrl??(same(playerId,insight.playerId)||same(playerId,legacyId)?insight.playerImageUrl:null)):null;
  const stats=player?Object.fromEntries(['goals','assists','points','saves','goalsAgainst'].filter(k=>Number.isFinite(player[k])).map(k=>[k,player[k]])):insight.stats??{};
  return {playerId,playerName:player?.name??insight.player??null,teamId:team?.id??null,teamName:team?.name??null,
    teamLogoUrl:(team?.logoUrl??(team&&same(team.id,insight.teamId)?insight.teamLogoUrl:null))??null,photoUrl:photo??null,
    stats,identityAvailable:!!(team&&(!playerId||player)),type:insight.type};
}
export const insightLabel=type=>({OFFICIAL_STAR:'MATCH STAR',HATTRICK:'HATTRICK HERO',MULTIPOINT_GAME:'POINT MACHINE',BIG_SAVES:'THE WALL',EARLY_GOAL:'FAST START',BIG_WIN:'BIG WIN'}[type]??'GAME MOMENT');
export function insightStat(subject,lang=language){
  const s=subject?.stats??{};
  const pair=subject?.type==='HATTRICK'?['goals',t('GÓLY',{},lang)]:subject?.type==='BIG_SAVES'?['saves',t('ZÁKROKŮ',{},lang)]:subject?.type==='MULTIPOINT_GAME'?['points',t('BODY',{},lang)]:null;
  return pair&&Number.isFinite(s[pair[0]])?{value:s[pair[0]],label:pair[1]}:null;
}

export function brandingScope(org,game,kind){if(!game)return null;return JSON.stringify([org,game.competition??'',kind==='groupLogo'?game.group??'':null,kind]);}
