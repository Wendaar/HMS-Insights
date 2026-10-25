// Shared read model. No rates, payment rules or missing source fields are guessed.
export const dateValid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export const shift=(v,n)=>{const d=new Date(v+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function periods(from,to){if(!dateValid(from)||!dateValid(to)||from>to)throw new TypeError('Vyberte platné období.');const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;if(days>93)throw new TypeError('Vyberte nejvýše 93 dní.');return {previous:{from:shift(from,-days),to:shift(from,-1)},selected:{from,to},next:{from:shift(to,1),to:shift(to,days)}};}
const clean=v=>typeof v==='string'?v.trim().slice(0,160):'';
export function people(value){if(value===undefined)return null;return [...new Set((Array.isArray(value)?value:[value]).flatMap(p=>typeof p==='string'?p.split(/[;,\n]+/):p&&typeof p==='object'?[p.name||[p.firstName,p.lastName].filter(Boolean).join(' ')]:[]).map(clean).filter(Boolean))];}
const path=(object,key)=>key?.split('.').reduce((value,part)=>value?.[part],object);
export function normalizeGame(g,rules={}){
 const team=t=>({id:clean(t?.teamId),name:clean(t?.name),cash:!rules.cashPath?null:path(t,rules.cashPath)===undefined?null:String(path(t,rules.cashPath)).toUpperCase().split(/[\s,;|]+/).includes(String(rules.cashValue??'CASH').toUpperCase())});
 const payment=path(g,rules.paidPath),home=team(g.HomeTeam),away=team(g.AwayTeam);
 const paid=payment===undefined||payment===null?null:payment===(rules.paidValue??'PAID')?true:rules.unpaidValues?.includes(payment)?false:null;
 const competition=g.Phase?.Group?.Season?.Competition??g.Competition;
 return {id:g.gameId,date:g.startDate,time:clean(g.startTime).slice(0,5),status:clean(g.status).toUpperCase(),home,away,teamsKnown:Object.hasOwn(g,'HomeTeam')&&Object.hasOwn(g,'AwayTeam'),competitionId:clean(competition?.competitionId),competition:clean(competition?.name)||'Soutěž neurčena',venue:clean(g.Venue?.name),referees:people(g.referee),timekeepers:people(g.timekeeper),paid};
}
export function warnings(game,today){
 if(['CANCELLED','CANCELED','DELETED'].includes(game.status))return [];
 const result=[];
 if(game.referees===null||game.timekeepers===null)result.push('staff_unknown');
 if(game.referees?.length===0)result.push('referee');if(game.timekeepers?.length===0)result.push('timekeeper');
 if(game.teamsKnown&&(!game.home.id||!game.away.id))result.push(game.date>=today?'ice':'past_teams');
 if(!game.teamsKnown)result.push('teams_unknown');
 if(game.date<today){
  if([game.home,game.away].some(t=>t.cash===true)&&game.paid!==true)result.push(game.paid===false?'cash':'payment_unknown');
  else if([game.home,game.away].some(t=>t.id&&t.cash===null))result.push('cash_unknown');
 }
 if(!game.competitionId)result.push('competition_unknown');
 return result;
}
export const warningLabels={referee:'Chybí rozhodčí',timekeeper:'Chybí časoměřič',ice:'Volný led · chybí soupeř',past_teams:'Minulý zápas bez soupeře',cash:'CASH bez úhrady',payment_unknown:'CASH · PAID nepotvrzeno',cash_unknown:'Platební režim týmu k ověření',staff_unknown:'Personál není ve zdroji',teams_unknown:'Týmy nejsou ve zdroji',competition_unknown:'Soutěž není ve zdroji'};
export function aggregate(games,range,{competition='',q='',today}={}){
 const windows=periods(range.from,range.to),fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const filtered=games.filter(g=>(!competition||(g.competitionId||g.competition)===competition)&&(!q||fold([g.home.name,g.away.name,...g.referees??[],...g.timekeepers??[]].join(' ')).includes(fold(q))));
 const inWindow=(g,w)=>g.date>=w.from&&g.date<=w.to;
 const selected=filtered.filter(g=>inWindow(g,windows.selected)).map(g=>({...g,warnings:warnings(g,today)}));
 const staff=new Map(),teams=new Map();
 for(const g of filtered){if(['CANCELLED','CANCELED','DELETED'].includes(g.status))continue;const period=Object.keys(windows).find(k=>inWindow(g,windows[k]));if(!period)continue;
  for(const [role,names]of [['Rozhodčí',g.referees],['Časoměřič',g.timekeepers]])for(const name of names??[]){const key=JSON.stringify([name,role,g.competitionId||g.competition]);const row=staff.get(key)??{name,role,competition:g.competition,previous:0,selected:0,next:0};row[period]++;staff.set(key,row);}
 }
 for(const g of selected){if(['CANCELLED','CANCELED','DELETED'].includes(g.status))continue;for(const t of [g.home,g.away]){if(!t.id)continue;const key=JSON.stringify([t.id,g.competitionId||g.competition]);const row=teams.get(key)??{team:t.name||'Tým bez názvu',competition:g.competition,games:0,finished:0,cash:0,review:0};row.games++;if(g.status==='FINISHED')row.finished++;if(t.cash===true)row.cash++;if(g.warnings.length)row.review++;teams.set(key,row);}}
 return {games:selected,staff:[...staff.values()].sort((a,b)=>a.name.localeCompare(b.name,'cs')),teams:[...teams.values()],windows};
}
export function csv(rows,columns){const cell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@\-\t\r]/,"'$&")+'"';return '\ufeff'+[columns.map(c=>cell(c[1])).join(';'),...rows.map(row=>columns.map(([key])=>cell(Array.isArray(row[key])?row[key].join(', '):row[key])).join(';'))].join('\r\n');}
