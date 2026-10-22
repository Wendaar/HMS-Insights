// Tool domain: independent of Google Sheets, HTTP, persistence and presentation.
import {sportingImage} from '../../public/game-report-media.js';
export const fields = {
  id:['Player Id','PlayerId'], name:['FirstName LastName','Full Name','Player Name','Name'],
  firstName:['FirstName','First Name'], lastName:['LastName','Last Name'],
  team:['Team','Team Name','TeamName'], teamId:['Team Id','TeamId'],
  starts:['GP','Starts','Games Played'], goals:['G','Goals'], assists:['A','Assists'],
  level:['PlayerLevelName','Player Level Name','Level'], photo:['Player Logo (Medium)','Player Logo Medium'],
  teamLogo:['Team Logo (Medium)','Team Logo Medium'], competition:['Competition'], season:['Season'], group:['Group'], phase:['Phase'],
};
const text=(value,max=120)=>typeof value==='string'&&value.trim().length<=max&&!/[\x00-\x1f<>]/.test(value)?value.trim():null;
export const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function validateSettings(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Chybí nastavení aplikace.');
  const title=text(input.title),competition=text(input.competition),season=text(input.season),minStarts=input.minStarts;
  if(!title||competition===null||season===null||!Number.isInteger(minStarts)||minStarts<1||minStarts>200)throw new TypeError('Vyplňte název a limit 1 až 200 startů.');
  const source=input.source;
  if(source?.type!=='google-sheet'||!/^[-\w]{20,120}$/.test(source.spreadsheetId??'')||!text(source.sheetName,80))throw new TypeError('Vyplňte platné ID Google tabulky a název záložky.');
  const mapping={};for(const key of Object.keys(fields)){
    const value=source.mapping?.[key]??'';if(text(value,80)===null)throw new TypeError('Neplatné mapování sloupců.');mapping[key]=value.trim();
  }
  const filters={};for(const key of ['competition','season','phase']){
    const value=source.filters?.[key]??'';if(text(value)===null)throw new TypeError('Neplatný filtr zdroje.');filters[key]=value.trim();
  }
  const accent=input.accent??'#176550';if(!/^#[0-9a-f]{6}$/i.test(accent))throw new TypeError('Neplatná barva.');
  return {title,competition,season,minStarts,accent,showPoints:input.showPoints!==false,showPhotos:input.showPhotos!==false,
    source:{type:'google-sheet',spreadsheetId:source.spreadsheetId,sheetName:source.sheetName.trim(),mapping,filters}};
}
export function bootstrapInstance(org,slug){
  if(org!=='PHM'||slug!=='phm-cup-2026')return null;
  const config=validateSettings({title:'Hráči pro playoff 2026',competition:'PHM Cup',season:'2025–2026',minStarts:9,accent:'#176550',
    source:{type:'google-sheet',spreadsheetId:'1MlsEBrd72RjeKS8vrnapjtu0KfIUaLciIYrEG_uc-rM',sheetName:'Players_Stats',
      filters:{competition:'PHM Cup',season:'2025-2026',phase:'Základní část'}}});
  return {draft:config,published:config,revision:0,updatedAt:null,publishedAt:null,bootstrap:true};
}
export function publicSettings(config){
  const {title,competition,season,minStarts,accent,showPoints,showPhotos}=config;
  return {title,competition,season,minStarts,accent,showPoints,showPhotos};
}
export function parseCsv(input){
  const csv=String(input).replace(/^\uFEFF/,'');if(csv.length>4*1024*1024)throw new Error('Zdroj je příliš velký.');
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(quoted){if(ch==='"'&&csv[i+1]==='"'){value+='"';i++;}else if(ch==='"')quoted=false;else value+=ch;}
    else if(ch==='"'){if(value)throw new Error('Neplatný CSV soubor.');quoted=true;}
    else if(ch===','||ch==='\n'){row.push(value);value='';if(row.length>128)throw new Error('Zdroj má příliš mnoho sloupců.');if(ch==='\n'){rows.push(row);row=[];if(rows.length>20001)throw new Error('Zdroj má příliš mnoho řádků.');}}
    else if(ch!=='\r')value+=ch;
  }
  if(quoted)throw new Error('Neukončená hodnota v CSV.');if(value||row.length){row.push(value);rows.push(row);}
  const headers=(rows.shift()??[]).map(h=>h.trim());
  if(!headers.length||headers.length>128||rows.length>20000||new Set(headers.map(fold)).size!==headers.length)throw new Error('Chybějící nebo duplicitní hlavičky CSV.');
  return {headers,rows:rows.filter(row=>row.some(v=>v.trim())).map(row=>{if(row.length>headers.length)throw new Error('Řádek neodpovídá hlavičkám.');return Object.fromEntries(headers.map((h,i)=>[h,row[i]??'']));})};
}
function imageUrl(value){
  try{return value.length<2048&&!new URL(value).port?sportingImage(value):null;}catch{return null;}
}
function count(value){const s=String(value??'').trim();if(!/^\d+$/.test(s))return null;const n=Number(s);return Number.isSafeInteger(n)&&n<=100000?n:null;}
export function normalizePlayers(table,config){
  const mapping={};for(const [key,aliases] of Object.entries(fields)){
    const explicit=config.source.mapping[key];mapping[key]=explicit?table.headers.find(h=>h===explicit):table.headers.find(h=>aliases.some(a=>fold(a)===fold(h)));
    if(explicit&&!mapping[key])throw new Error(`Chybí sloupec „${explicit}“.`);
  }
  if(!mapping.starts||(!mapping.team&&!mapping.teamId)||(!mapping.name&&!mapping.firstName&&!mapping.lastName))throw new Error('Zdroj musí obsahovat jméno hráče, tým a počet startů. Zkontrolujte mapování sloupců.');
  for(const [key,value] of Object.entries(config.source.filters))if(value&&!mapping[key])throw new Error(`Zdroj neobsahuje sloupec pro filtr ${key}.`);
  const players=[],seen=new Map();let skipped=0,unknown=0;
  for(const row of table.rows){
    const get=key=>String(row[mapping[key]]??'').trim().slice(0,250);
    if(Object.entries(config.source.filters).some(([key,value])=>value&&fold(get(key))!==fold(value)))continue;
    const name=get('name')||[get('firstName'),get('lastName')].filter(Boolean).join(' '),team=get('team')||get('teamId');
    if(!name||!team){skipped++;continue;}
    const starts=count(get('starts')),goals=count(get('goals')),assists=count(get('assists'));
    const p={id:get('id')||name,teamId:get('teamId')||team,name,team,starts,goals,assists,points:goals===null||assists===null?null:goals+assists,
      level:get('level'),group:get('group'),photo:config.showPhotos?imageUrl(get('photo')):null,teamLogo:config.showPhotos?imageUrl(get('teamLogo')):null,
      eligibility:starts===null?'unknown':starts>=config.minStarts?'eligible':'below'};
    const key=JSON.stringify([p.teamId,p.id]),previous=seen.get(key);
    if(previous){if(JSON.stringify(previous)!==JSON.stringify(p))throw new Error('Zdroj obsahuje rozdílné řádky stejného hráče za stejný tým. Upřesněte filtry zdroje.');continue;}
    seen.set(key,p);players.push(p);if(starts===null)unknown++;
  }
  players.sort((a,b)=>(b.starts??-1)-(a.starts??-1)||a.name.localeCompare(b.name,'cs'));
  return {players,headers:table.headers.filter(h=>Object.values(mapping).includes(h)),warnings:[...(unknown?[`${unknown} hráčů nemá ověřený počet startů.`]:[]),...(skipped?[`${skipped} řádků bez jména nebo týmu bylo vynecháno.`]:[])],totalSourceRows:table.rows.length};
}
