import {parseCsv,normalizePlayers} from '../app/playoff-players.js';
// Adapter returns the tool's stable sporting model, never raw rows or contacts.
const MAX_BYTES=4*1024*1024;
function allowed(url){return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(url.hostname==='docs.google.com'||url.hostname.endsWith('.googleusercontent.com'));}
export async function readPlayoffSource(config,{fetchImpl=fetch}={}){
  const source=config.source;
  if(source.type!=='google-sheet')throw new Error('Zdroj zatím není podporovaný.');
  let url=new URL(`https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/gviz/tq`);
  url.search=new URLSearchParams({tqx:'out:csv',sheet:source.sheetName}).toString();
  const signal=AbortSignal.timeout(10000);let response;
  for(let hop=0;hop<4;hop++){
    if(!allowed(url))throw new Error('Nepovolené přesměrování zdroje.');
    response=await fetchImpl(url,{signal,redirect:'manual',credentials:'omit',headers:{accept:'text/csv'}});
    if(response.status>=300&&response.status<400){const target=response.headers.get('location');await response.body?.cancel();if(!target)throw new Error('Zdroj není dostupný.');url=new URL(target,url);response=null;continue;}
    break;
  }
  if(!response?.ok||Number(response.headers.get('content-length'))>MAX_BYTES){await response?.body?.cancel();throw new Error('Google tabulka není veřejně čitelná nebo neodpovídá.');}
  const reader=response.body?.getReader();if(!reader)throw new Error('Zdroj nevrátil data.');
  const chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw new Error('Zdroj je příliš velký.');chunks.push(value);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
  const csv=Buffer.concat(chunks).toString('utf8');
  if(/^\s*</.test(csv))throw new Error('Google tabulka vyžaduje přihlášení nebo záložka není dostupná.');
  return {...normalizePlayers(parseCsv(csv),config),readAt:new Date().toISOString(),sourceLabel:`Google Sheet · ${source.sheetName}`};
}
