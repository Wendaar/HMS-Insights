import {apiGame} from './hms-source.js';
import {fetchSponsorCatalog} from '../sponsors/model.js';
// One bounded data reader per compositor; both logical layers share verified data.
// Presentation stays in the channel state. Refreshing data never publishes it.
export function createDirectorData({api='/api/broadcast',origin=globalThis.location?.origin??'http://localhost',onChange=()=>{},fetchImpl=fetch}={}){
 const records=new Map();let stopped=false;
 function record(scope){
  const key=scope.org+':'+String(scope.gameId).toLowerCase();
  if(!records.has(key)){if(records.size>=4)records.delete(records.keys().next().value);records.set(key,{org:scope.org,gameId:scope.gameId,game:null,sponsorCatalog:null,reads:{},success:{},pending:{},errors:{}});}
  return records.get(key);
 }
 async function read(entry,part){
  if(entry.pending[part]||stopped)return;
  entry.pending[part]=true;entry.reads[part]=Date.now();
  try{
   if(part==='sponsors')entry.sponsorCatalog=await fetchSponsorCatalog(entry.org);
   else{
    const url=new URL(api,origin);url.search=new URLSearchParams({org:entry.org,gameId:entry.gameId,...(part==='game'?{live:'1'}:{[part]:'1'})});
    const response=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(part==='context'?65000:16000)});
    if(!response.ok)throw new Error('Broadcast data unavailable');
    const game=apiGame(await response.json(),entry.org,entry.gameId);
    if(part==='game')entry.game={...game,context:game.context??entry.game?.context??null,league:game.league??entry.game?.league??null};
    else if(entry.game)entry.game[part]=game[part];
    else entry[part]=game[part];
    if(entry.game)for(const optional of ['context','league'])if(entry[optional]){entry.game[optional]=entry[optional];delete entry[optional];}
   }
   entry.errors[part]=false;entry.success[part]=Date.now();
  }catch{entry.errors[part]=true;if(part==='context'&&entry.game)entry.game.context={historyAvailable:false,nextAvailable:false};if(part==='league'&&entry.game)entry.game.league={leadersAvailable:false,standingsAvailable:false};}
  finally{entry.pending[part]=false;if(!stopped)onChange();}
 }
 return {
  get(scope){
   const entry=record(scope),now=Date.now(),ttl=['opening','sponsors','announcement','cta'].includes(scope.layer)?60000:15000;
   if(!entry.reads.game||now-entry.reads.game>=ttl)read(entry,'game');
   if(['powerplay','next','results'].includes(scope.layer)&&(!entry.reads.context||now-entry.reads.context>=120000))read(entry,'context');
   if(['leaders','leaders-strip','standings'].includes(scope.layer)&&(!entry.reads.league||now-entry.reads.league>=60000))read(entry,'league');
   if(['sponsors','announcement'].includes(scope.layer)&&scope.partnerSource==='hms'&&(!entry.reads.sponsors||now-entry.reads.sponsors>=60000))read(entry,'sponsors');
   const expired=entry.errors.game&&now-(entry.success.game??0)>(scope.layer==='opening'?600000:60000);
   return {game:expired?null:entry.game,sponsorCatalog:entry.sponsorCatalog,errors:entry.errors,readAt:entry.success.game??0};
  },
  stop(){stopped=true;records.clear();},
 };
}
