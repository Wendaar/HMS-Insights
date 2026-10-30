import {isGameId} from '../domain/game-summary.js';
import {sportingImage} from '../../public/game-report-media.js';
import {readPlayerPortraits} from './broadcast-league.js';
const lower=value=>String(value??'').toLowerCase();

// Match both player and team inside a group verified by this month's fixtures.
// No current-season totals, positions or rankings enter monthly nominations.
export async function refreshAllStarsPortraits(data,fixtures,scope,options={}){
  const groups=[...new Set(fixtures.filter(g=>!scope.groupId||g.group.id===scope.groupId).map(g=>g.group.id).filter(isGameId))];
  const metadata={source:'HMS public player statistics',complete:true,updated:0};
  if(groups.length>50)return {...metadata,complete:false};
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,groups.length)},async()=>{
    while(cursor<groups.length){
      const groupId=groups[cursor++],allowed=new Set(fixtures.filter(g=>g.group.id===groupId).flatMap(g=>[g.home.id,g.away.id]));
      let tables;try{tables=await(options.readPlayerPortraits??readPlayerPortraits)(groupId,options);}catch{metadata.complete=false;continue;}
      for(const [kind,roles]of [['players',['F','D']],['goalies',['G']]]){
        const rows=tables?.[kind];if(!Array.isArray(rows)||rows.length>20000){metadata.complete=false;continue;}
        const images=new Map();
        for(const row of rows){
          if(!row||!isGameId(row.PlayerId)||!allowed.has(lower(row.TeamId)))continue;
          const key=lower(row.PlayerId)+'|'+lower(row.TeamId),image=sportingImage(row.PlayerLogo);
          // Ambiguous or missing photos never erase a useful imported portrait.
          if(images.has(key)&&images.get(key)!==image)images.set(key,null);else if(!images.has(key))images.set(key,image);
        }
        for(const role of roles)for(const player of data.candidates[role]){
          const image=images.get(player.id);if(image){if(image!==player.imageUrl)metadata.updated++;player.imageUrl=image;}
        }
      }
    }
  }));
  return metadata;
}
