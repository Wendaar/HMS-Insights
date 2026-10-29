import {createHash} from 'node:crypto';
import {REGISTRATION_SCOPE, uuid} from './registration-control.js';
const clean = value => String(value ?? '').trim().normalize('NFC').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
const hash = value => createHash('sha256').update(value).digest('hex');
export class RegistrationCsvError extends Error {}
const fail = message => {throw new RegistrationCsvError(message);};
export function parseRegistrationCsv(input) {
  if(typeof input!=='string'||Buffer.byteLength(input)>2_000_000)fail('CSV smí mít nejvýše 2 MB.');
  const source=input.replace(/^\uFEFF/,''), first=source.split(/\r?\n/,1)[0];
  const delimiter=(first.match(/;/g)?.length??0)>(first.match(/,/g)?.length??0)?';':',';
  const rows=[];let row=[],value='',quoted=false,closed=false;
  const cell=()=>{row.push(value);value='';closed=false;if(row.length>50)fail('CSV má příliš mnoho sloupců.');};
  const line=()=>{cell();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>20001)fail('CSV má příliš mnoho řádků.');};
  for(let i=0;i<source.length;i++){
    const ch=source[i];
    if(quoted){if(ch==='"'&&source[i+1]==='"'){value+='"';i++;}else if(ch==='"'){quoted=false;closed=true;}else value+=ch;}
    else if(ch===delimiter)cell();
    else if(ch==='\n')line();
    else if(ch==='\r'&&(source[i+1]==='\n'||i===source.length-1))continue;
    else if(ch==='"'&&!value&&!closed)quoted=true;
    else {if(closed||ch==='"')fail('CSV obsahuje neplatné uvozovky.');value+=ch;}
    if(value.length>5000)fail('CSV obsahuje příliš dlouhou buňku.');
  }
  if(quoted)fail('CSV má neukončenou hodnotu v uvozovkách.');if(value||row.length||closed)line();
  const headers=(rows.shift()??[]).map(clean), seen=new Set();
  for(const header of headers){if(!header||seen.has(header)&&header!=='Created At')fail('CSV má chybějící nebo duplicitní sloupce.');seen.add(header);}
  for(const header of ['ID','Player','Teams','Competition','Season','Accepted by Player'])if(!seen.has(header))fail('CSV nemá požadovaný sloupec: '+header+'.');
  if(!seen.has('Player Link')&&!seen.has('Player ID'))fail('CSV musí obsahovat Player Link nebo Player ID pro bezpečné spojení hráčů.');
  if(rows.some(r=>r.length!==headers.length))fail('Počet hodnot na řádku neodpovídá hlavičce CSV.');
  return {headers,rows:rows.map((r,index)=>({line:index+2,get:name=>clean(r[headers.indexOf(name)]??'')}))};
}
function playerId(row){
  const direct=row.get('Player ID');if(direct){if(!uuid(direct))fail('Neplatné Player ID na řádku '+row.line+'.');return direct.toLowerCase();}
  try{const url=new URL(row.get('Player Link')),parts=url.pathname.split('/').filter(Boolean),id=parts.at(-1);
    if(url.protocol==='https:'&&url.hostname==='prod.hms.wootera.net'&&!url.username&&!url.password&&!url.search&&!url.hash&&parts[0]==='org'&&parts[1]==='phm'&&parts[2]==='players'&&uuid(id))return id.toLowerCase();
  }catch{}
  fail('Neplatný odkaz hráče na řádku '+row.line+'.');
}
function flag(value,yes,no,line,label){if(!value)return null;const norm=v=>v.toUpperCase().replaceAll('_',' ');if(yes.map(norm).includes(norm(value)))return true;if(no.map(norm).includes(norm(value)))return false;fail('Neznámá hodnota '+label+' na řádku '+line+'.');}
export function buildRegistrationImport(csv,catalog,{previous=null,mappings={},filename=''}={}){
  const table=parseRegistrationCsv(csv),teams=new Map(),names=new Map();
  if(!Array.isArray(catalog)||!catalog.length)fail('Není dostupný ověřený seznam týmů této sezony.');
  for(const t of catalog){if(!uuid(t.id)||!clean(t.name)||teams.has(t.id.toLowerCase()))fail('Seznam týmů není jednoznačný.');
    const id=t.id.toLowerCase(),name=clean(t.name);teams.set(id,{teamId:id,name,players:[]});names.set(name,[...(names.get(name)??[]),id]);}
  const seen=new Set(),playersByTeam=new Set(),pending=[],assignments=[],registrationIds=[];
  const prior=new Map((previous?.assignments??[]).map(a=>[a.registrationId,a]));
  let scopeRows=0,excludedScope=0,unknownPaid=0,unknownMethod=0,unknownConfirmed=0;
  for(const row of table.rows){
    const id=row.get('ID').toLowerCase();if(!uuid(id)||seen.has(id))fail('Neplatné nebo duplicitní ID registrace na řádku '+row.line+'.');seen.add(id);
    if(row.get('Competition')!=='PHM Cup'||row.get('Season')!=='2026-2027'){excludedScope++;continue;}
    scopeRows++;registrationIds.push(id);
    const pid=playerId(row),name=row.get('Player');if(!name||name.length>160)fail('Chybějící nebo příliš dlouhé jméno na řádku '+row.line+'.');
    const teamText=row.get('Teams'),binding=hash(pid+'\n'+teamText),automatic=names.get(teamText);
    const supplied=Object.hasOwn(mappings,id)?mappings[id]:undefined;
    const saved=prior.get(id),reusable=saved?.binding===binding&&teams.has(saved.teamId);
    let target=supplied!==undefined?supplied:reusable?saved.teamId:automatic?.length===1?automatic[0]:null;
    if(target!==null&&(!uuid(target)||!teams.has(target.toLowerCase())))fail('Ruční přiřazení obsahuje tým mimo tuto sezonu.');
    target=target?.toLowerCase()??null;
    const accepted=flag(row.get('Accepted by Player'),['YES'],['NO'],row.line,'souhlasu');
    const paid=flag(row.get('Payment Status'),['PAID','YES'],['UNPAID','NOT PAID','NOT_PAID','NO'],row.line,'úhrady');
    const method=row.get('Payment Method').toUpperCase()||null,status=row.get('Registration Status');
    if(method?.length>64)fail('Příliš dlouhá platební metoda na řádku '+row.line+'.');
    const confirmed=flag(status,['CONFIRMED','Confirmed','YES'],['WAITING','Waiting','Waiting For Accepting','Waiting For Payment','NOT CONFIRMED','NO'],row.line,'potvrzení');
    if(paid===null)unknownPaid++;if(!method)unknownMethod++;if(confirmed===null)unknownConfirmed++;
    const actions=[];
    if(accepted===false)actions.push('Hráč musí přijmout podmínky registrace.');
    if(accepted===null)actions.push('Export neobsahuje přijetí podmínek.');
    if(!method)actions.push('Platební metoda v exportu chybí.');
    if(paid===false)actions.push(method==='CASH'?'Platí manažer: úhrada není potvrzena.':'Úhrada není potvrzena.');
    if(paid===null)actions.push('Úhradu nelze z tohoto exportu ověřit.');
    if(confirmed===false)actions.push('Registrace zatím není potvrzena.');
    if(confirmed===null)actions.push('Stav potvrzení v exportu chybí.');
    const player={registrationId:id,playerId:pid,name,photoUrl:null,memberStatus:null,invited:null,latestInvite:null,accepted,
      paymentMethod:method,paid,confirmed,ok:confirmed===true&&accepted===true&&paid===true&&!!method,actions};
    if(target){const key=target+':'+pid;if(playersByTeam.has(key))fail('Hráč má více registrací pro stejný tým a sezonu. Zkontrolujte export.');playersByTeam.add(key);teams.get(target).players.push(player);
      if(supplied!==undefined||reusable)assignments.push({registrationId:id,binding,teamId:target});
    }else pending.push({registrationId:id,name,teams:teamText});
  }
  for(const key of Object.keys(mappings))if(!registrationIds.includes(key))fail('Ruční přiřazení nepatří do tohoto exportu.');
  if(!scopeRows)fail('CSV neobsahuje registrace PHM Cup 2026-2027. Dosavadní data zůstala zachována.');
  const result=[...teams.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs'));
  for(const team of result)team.players.sort((a,b)=>a.name.localeCompare(b.name,'cs'));
  const removed=(previous?.registrationIds??[]).filter(id=>!registrationIds.includes(id)).length;
  return {scope:REGISTRATION_SCOPE,source:'csv',sourceHash:hash(csv),filename:clean(filename).replace(/[\\/]/g,'_').slice(0,160),
    teams:result,pending,assignments,registrationIds,
    summary:{totalRows:table.rows.length,seasonRows:scopeRows,excludedScope,assigned:scopeRows-pending.length,unassigned:pending.length,
      unknownPaid,unknownMethod,unknownConfirmed,removed,teamCount:result.filter(t=>t.players.length).length},
    limitations:['Export registrací není úplná soupiska ACTIVE/INVITED. Stav členství ani skutečné sezonní pozvánky nejsou v tomto souboru dostupné.',
      'E-mail se v tomto přehledu nezpracovává. Prázdná úhrada neznamená nezaplaceno. Nejednoznační hráči nejsou v týmových pohledech, dokud je správce nepřiřadí.']};
}
