export const organizations=['PHM','EUCHL'];
export const isGameId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const image=value=>{
  try{const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&['prod-hms-wootera.s3.eu-central-1.amazonaws.com','hockeymanagementsystem.s3.amazonaws.com'].includes(u.hostname)&&!u.search&&!u.hash?u.href:null;}catch{return null;}
};
export function parseGameInput(value,currentOrg='PHM'){
  let id=String(value??'').trim(),org=currentOrg.toUpperCase();
  if(id.startsWith('https://')){
    const url=new URL(id),match=/^\/org\/([^/]+)\/games\/([^/]+)\/?$/.exec(url.pathname);
    if(url.hostname!=='prod.hms.wootera.net'||url.port||url.username||url.password||!match)throw new Error('Vložte HMS odkaz na zápas nebo Game ID.');
    org=match[1].toUpperCase();id=match[2];
  }
  if(!organizations.includes(org)||!isGameId(id))throw new Error('Vyberte PHM nebo EUCHL a vložte platné Game ID.');
  return {org,gameId:id};
}
export function apiGame(data,org,id){
  if(data.schemaVersion!==1||data.org!==org||!isGameId(data.gameId)||data.gameId.toLowerCase()!==id.toLowerCase())throw new Error('Odpověď neodpovídá vybranému zápasu a organizaci.');
  if(!data.home?.name||!data.away?.name)throw new Error('V HMS chybí názvy týmů.');
  const date=/^\d{4}-\d{2}-\d{2}$/.test(data.date??'')?data.date:null;
  return {ID:data.gameId,Name:`${data.home.name} — ${data.away.name}`,'Home Team':data.home.name,'Away Team':data.away.name,
    Date:date?date.split('-').reverse().join('. '):'',DateISO:date,Time:/^\d{2}:\d{2}$/.test(data.time??'')?data.time:'',Venue:data.venue??'',
    Competition:data.competition??'',Group:data.group??'',Referee:data.referee??'',Timekeeper:data.timekeeper??'',
    homeLogo:image(data.home.logoUrl),awayLogo:image(data.away.logoUrl),brandLogos:[image(data.competitionLogoUrl),image(data.organizationLogoUrl)].filter(Boolean),
    status:data.status,match:data.match??null,homeId:data.home.id,awayId:data.away.id,context:data.context??null,league:data.league??null,
    warnings:[!data.referee?'Rozhodčí zatím není v HMS vyplněný.':'',!data.timekeeper?'Časoměřič zatím není v HMS vyplněný.':'',!data.venue?'Místo zatím není v HMS vyplněné.':''].filter(Boolean)};
}
export function viewUrl(base,{mode='overlay',org='PHM',gameId,source='hms',clean=false,lang='cs',layer='opening',side='home',period='current',page=1,insight='',corner='bottom-left',metric='goals',assetId='',rotateSeconds=15,library='',partnerSource='library',partnerScope='team',standingsView='opponents'}){
  const parent=new URL(base);if(/\/broadcast\/?$/.test(parent.pathname))parent.pathname='/broadcast/index.html';
  const url=new URL('index.html',parent);url.search=new URLSearchParams({mode,org,game:gameId,source,lang,layer,side,period,page:String(page),corner,metric,assetId,partnerSource,partnerScope,standingsView,rotateSeconds:String(rotateSeconds),...(library?{library}:{}),...(insight?{insight}:{}),...(clean?{clean:'1'}:{})}).toString();url.hash='';return url.href;
}
