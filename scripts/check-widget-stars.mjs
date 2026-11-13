// Read-only audit: compare the same official player/team records and scopes.
import {officialPlayers,rankLeaders} from '../public/widgets/statistics.js';
const base='https://public.heromanagementsystem.com',names=['Radek Postupa','Jan Pravda','Dominik Bláha','Eduard Synák'];
async function read(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status+' '+new URL(url).pathname);return r.json();}
const portal=await read(base+'/api/portal?org=phm&action=public'),seasonId=portal.season.seasonId;
const directory=await read(base+'/api/portal?'+new URLSearchParams({org:'phm',action:'data',section:'system',seasonId}));
const seasonRows=await read('https://api.prod.hms.wootera.net/public/playersStats?'+new URLSearchParams({seasonId}));
const phaseIds=directory.groups.flatMap(g=>g.phases.map(p=>p.id));
const phaseRows=await read('https://api.prod.hms.wootera.net/public/playersStats?'+new URLSearchParams({phaseIds:phaseIds.join(',')}));
const values=rows=>new Map(officialPlayers(rows).map(p=>[p.id+'|'+p.teamId,p]));
const season=values(seasonRows),phases=values(phaseRows),mismatches=[];
for(const [key,p]of season)if(phases.get(key)?.stars!==p.stars)mismatches.push({name:p.name,seasonStars:p.stars,phaseStars:phases.get(key)?.stars??null});
for(const [key,p]of phases)if(!season.has(key))mismatches.push({name:p.name,seasonStars:null,phaseStars:p.stars});
const snapshot=rows=>rankLeaders(officialPlayers(rows),'stars',5).map(p=>({name:p.name,stars:p.stars,rank:p.rank,teamId:p.teamId}));
console.log(JSON.stringify({seasonId,competitionId:portal.season.competitionId,phaseIds,source:'HMS public playersStats',definition:'Stars field, no derived calculation',namedPlayers:[...season.values()].filter(p=>names.includes(p.name)).map(p=>({name:p.name,playerId:p.id,teamId:p.teamId,stars:p.stars,phaseStars:phases.get(p.id+'|'+p.teamId)?.stars})),seasonTop5:snapshot(seasonRows),phaseIdsTop5:snapshot(phaseRows),valueMismatches:mismatches},null,2));
