import {mediaGame, browseMedia, timeWindow} from './media-engine.js';
import {organizationConfig} from './organizations.js';
import {readTeamComparison} from './team-comparison.js';
import {isGameId} from '../domain/game-summary.js';
import {publicOutputUrl} from '../../public/public-output.js';

export const reminderDefaults={enabled:false,automatic:false,language:'cs',branding:{title:'',accent:'#78e5b8'},schedule:{league:24,tournament:3},competitionTypes:{},recipientTeamIds:[]};
export function reminderConfig(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Invalid configuration');
  const v={...reminderDefaults,...value,branding:{...reminderDefaults.branding,...value.branding},schedule:{...reminderDefaults.schedule,...value.schedule}};
  if(typeof v.enabled!=='boolean'||typeof v.automatic!=='boolean'||!['cs','en'].includes(v.language)||!/^#[a-f0-9]{6}$/i.test(v.branding.accent)||typeof v.branding.title!=='string'||v.branding.title.length>80)throw new TypeError('Invalid configuration');
  if(!Object.values(v.schedule).every(n=>Number.isInteger(n)&&n>=0&&n<=168)||!Array.isArray(v.recipientTeamIds)||v.recipientTeamIds.length>500||!v.recipientTeamIds.every(isGameId)||!v.competitionTypes||Array.isArray(v.competitionTypes)||Object.keys(v.competitionTypes).length>100||!Object.entries(v.competitionTypes).every(([k,t])=>isGameId(k)&&['league','tournament'].includes(t)))throw new TypeError('Invalid schedule or recipients');
  return {enabled:v.enabled,automatic:v.automatic,language:v.language,branding:v.branding,schedule:{league:v.schedule.league,tournament:v.schedule.tournament},competitionTypes:v.competitionTypes,recipientTeamIds:v.recipientTeamIds.map(x=>x.toLowerCase())};
}
// Strict, quoted RFC4180 cells, comma or semicolon, UTF-8 BOM, bounded atomic import.
export function managerContacts(csv,organizationId) {
  if(typeof csv!=='string'||Buffer.byteLength(csv)>200000)throw new TypeError('CSV max 200 KB');
  csv=csv.replace(/^\uFEFF/,'');const delimiter=csv.split(/\r?\n/,1)[0].includes(';')?';':',';
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  const push=()=>{row.push(cell);cell='';closed=false;};
  for(let i=0;i<=csv.length;i++){const c=csv[i];
    if(quoted){if(c==='"'&&csv[i+1]==='"'){cell+='"';i++;}else if(c==='"'){quoted=false;closed=true;}else if(c===undefined)throw new TypeError('Unclosed CSV');else cell+=c;}
    else if(c==='"'&&!cell&&!closed)quoted=true;
    else if(c===delimiter)push();
    else if(c==='\n'||c===undefined){push();if(row.some(x=>x.trim()))rows.push(row);row=[];}
    else if(c==='\r'&&(csv[i+1]==='\n'||i===csv.length-1))continue;
    else {if(closed||c==='"')throw new TypeError('Invalid CSV');cell+=c;}
    if(cell.length>320||rows.length>1001||row.length>4)throw new TypeError('CSV limit');
  }
  if(rows.shift()?.join(',')!=='organisation_id,team_id,email,name')throw new TypeError('Expected organisation_id,team_id,email,name');
  const seen=new Set();return rows.map(r=>{const [org,team,email,name]=r.map(x=>x.trim());
    if(r.length!==4||org.toLowerCase()!==organizationId.toLowerCase()||!isGameId(team)||!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)||/[\r\n\x00-\x1f]/.test(name))throw new TypeError('Invalid or foreign contact');
    const key=team.toLowerCase()+':'+email.toLowerCase();if(seen.has(key))throw new TypeError('Duplicate contact');seen.add(key);
    return {teamId:team.toLowerCase(),email:email.toLowerCase(),name};
  });
}
export async function matchPreview(org,gameId,options={}) {
  const config=organizationConfig(org,options.env??process.env),game=await(options.mediaGame??mediaGame)(config.code,gameId,options);
  if(game.org!==config.code||!isGameId(game.gameId)||game.gameId.toLowerCase()!==gameId.toLowerCase())throw new Error('Foreign fixture');
  const today=timeWindow('Today',options.now).from;
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit'}).format(options.now??new Date());
  const upcoming=game.status==='NOT PLAYED'&&(game.playedOn>today||game.playedOn===today&&/^\d{2}:\d{2}/.test(game.startTime??'')&&game.startTime.slice(0,5)>clock);
  let comparison=null;
  // Current tables must never masquerade as historical pregame facts.
  if(upcoming&&options.includeComparison!==false&&game.seasonId&&game.groupId&&game.phaseId)try{comparison=await(options.compare??readTeamComparison)(config.code,game,options);}catch{}
  const side=key=>{const team=game[key],stats=comparison?.teams.find(t=>t.id.toLowerCase()===team.id?.toLowerCase());
    return {...team,preview:stats?{rank:stats.rank,points:stats.points,games:stats.games,score:stats.score,goalsFor:stats.goalsFor,goalsAgainst:stats.goalsAgainst,wins:stats.wins,draws:stats.draws,losses:stats.losses,form:stats.form,offense:stats.offense,defense:stats.defense,rating:stats.rating,attendance:stats.roster?.average??null,players:stats.players.slice(0,3)}:null};};
  return {schemaVersion:1,kind:'match-preview',org:config.code,gameId:game.gameId,date:game.playedOn,time:game.startTime??null,competitionId:game.competitionId,competition:game.competition,venue:game.venue,status:game.status,eligible:upcoming,home:side('home'),away:side('away'),branding:{organizationLogoUrl:game.organizationLogoUrl,competitionLogoUrl:game.competitionLogoUrl},links:{game:publicOutputUrl(`/game-center/${game.gameId}`),compare:publicOutputUrl(`/team-comparison/${config.slug}?seasonId=${game.seasonId??''}&groupId=${game.groupId??''}&phaseId=${game.phaseId??''}&left=${game.home.id}&right=${game.away.id}`)},readAt:game.readAt,statistics:comparison?'current-before-game':'unavailable',extensions:{postGameReport:null}};
}
export async function gameDay(org,input={},options={}) {
  const config=organizationConfig(org,options.env??process.env),date=input.date??timeWindow('Today',options.now).from;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new TypeError('Invalid date');
  const offset=Number(input.offset??0);if(!Number.isInteger(offset)||offset<0||offset>10000)throw new TypeError('Invalid offset');
  const page=await(options.browseMedia??browseMedia)({org:config.code,date,offset},options);
  const previews=new Array(page.items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,page.items.length)},async()=>{while(cursor<page.items.length){const at=cursor++;previews[at]=await matchPreview(config.code,page.items[at].gameId,{...options,includeComparison:false});}}));
  const items=previews.filter(p=>{if(p.date!==date)throw new Error('Foreign date');return(!input.competition||p.competition===input.competition)&&(!input.venue||p.venue===input.venue);});
  return {org:config.code,date,items,hasMore:page.hasMore,offset,source:page.source,filterScope:'page'};
}
export function invitation(p,{language='cs',branding={},jerseys={}}={}) {
  const en=language==='en',unknown=en?'Unavailable':'Nedostupné';
  const lines=[branding.title||'GAME DAY',`${p.home.name} × ${p.away.name}`,`${p.date} · ${p.time??unknown}`,`${p.competition??''} · ${p.venue??unknown}`];
  for(const side of ['home','away']){const t=p[side],s=t.preview;lines.push(`${t.name} · ${en?'Jersey':'Dres'}: ${jerseys[side]||t.jerseyColor||unknown}`);if(s)lines.push(`${en?'Rank':'Pořadí'}: ${s.rank??unknown} · ${en?'Form':'Forma'}: ${s.form.map(f=>f.result).join(' ')||unknown} · ${en?'Attack / defense':'Útok / obrana'}: ${s.offense?.toFixed(2)??unknown} / ${s.defense?.toFixed(2)??unknown} · ${en?'Attendance':'Účast'}: ${s.attendance?.toFixed(1)??unknown}`);}
  lines.push(p.links.game,p.links.compare);return lines.join('\n');
}
export function invitationHtml(p,options={}){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const accent=/^#[a-f0-9]{6}$/i.test(options.branding?.accent??'')?options.branding.accent:'#78e5b8';
 const text=invitation(p,options);
 return `<!doctype html><html lang="${options.language==='en'?'en':'cs'}"><body style="margin:0;background:#0b1c32;color:#fff;font-family:Arial,sans-serif"><table role="presentation" style="max-width:640px;width:100%;padding:32px;border-top:8px solid ${accent}"><tr><td><h1>${escape(options.branding?.title||'GAME DAY')}</h1>${text.split('\n').map(line=>`<p>${escape(line)}</p>`).join('')}<p><a style="color:${accent}" href="${escape(publicOutputUrl(p.links.game))}">${options.language==='en'?'Match details':'Detail zápasu'}</a></p></td></tr></table></body></html>`;
}
