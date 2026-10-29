const $ = id => document.getElementById(id);
const admin = location.pathname.includes('/control/') || location.pathname === '/registrations/admin';
// Fragments are never sent to the server, referrers or request/access logs.
let invitation = location.hash.slice(1);
history.replaceState(null,'',location.pathname);
let players = [], catalog, selected = '', loading = false;
let requestVersion = 0;
const el = (tag, text, className) => {const node=document.createElement(tag); if(text !== undefined) node.textContent=text; if(className) node.className=className; return node;};
const message = text => {$('message').textContent=text;};
const date = value => value ? new Date(value).toLocaleString('cs-CZ',{dateStyle:'medium',timeStyle:'short'}) : 'Datum není dostupné';
async function api(action, {post=false, token, teamId}={}) {
  const query = new URLSearchParams({action}); if(teamId) query.set('teamId',teamId);
  const headers = token ? {authorization:'Bearer '+token} : {};
  const response=await fetch('/api/registrations?'+query,{method:post?'POST':'GET',headers,cache:'no-store',credentials:'same-origin',redirect:'error'});
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'Přehled není dostupný.'); error.status=response.status; throw error;}
  return data;
}
function clearPlayers() {requestVersion++;players=[];$('overview').hidden=true;$('players').replaceChildren();$('totals').replaceChildren();}
function clearShare() {$('share-link').value='';$('new-link').hidden=true;}
function display(data) {
  players=data.team.players;$('overview').hidden=false;$('title').textContent=data.team.name;
  $('subtitle').textContent=data.label+' · Aktivní členové a hráči pozvaní do této sezony.';
  $('updated').textContent='Načteno z HMS: '+date(data.readAt)+'. Neznámé údaje nejsou považované za NE.';
  $('totals').replaceChildren();
  for(const [label,count] of [['Hráčů',players.length],['Uhrazeno',players.filter(p=>p.paid===true).length],['Neuhrazeno',players.filter(p=>p.paid===false).length],['Vyžaduje kontrolu',players.filter(p=>!p.ok).length]]) {
    const box=el('div',undefined,'total');box.append(el('strong',count),el('span',label));$('totals').append(box);
  }
  render();
}
function field(list,label,value,extra) {const group=el('div');group.append(el('dt',label));const dd=el('dd',value===true?'ANO':value===false?'NE':value??'Neověřeno',value===true?'yes':value===false?'no':value===null?'unknown':'');if(extra)dd.append(el('small',extra));group.append(dd);list.append(group);}
function render() {
  const search=$('search').value.trim().toLocaleLowerCase('cs'),filter=$('filter').value;
  const rows=players.filter(p=>(p.name+' '+(p.email??'')).toLocaleLowerCase('cs').includes(search)&&
    (filter==='all'||filter==='attention'&&!p.ok||filter==='unpaid'&&p.paid===false||filter==='not-accepted'&&p.accepted===false||filter==='unknown'&&[p.accepted,p.paid,p.confirmed,p.email].includes(null)));
  $('players').replaceChildren();$('empty').hidden=rows.length>0;
  for(const p of rows) {
    const card=el('article'),identity=el('div',undefined,'identity');
    let avatar=el('span',p.name.split(/\s+/).map(x=>x[0]).slice(0,2).join(''),'avatar');
    if(p.photoUrl){avatar=el('img');avatar.className='avatar';avatar.src=p.photoUrl;avatar.alt='';avatar.loading='lazy';avatar.referrerPolicy='no-referrer';}
    const title=el('div');title.append(el('h2',p.name),el('p',p.email??'E-mail není v HMS dostupný'));identity.append(avatar,title,el('span',p.memberStatus,'member-status'));card.append(identity);
    const details=el('dl',undefined,'details');
    field(details,'Pozván do 2026/27',p.invited,p.invited?'Poslední pozvánka: '+date(p.latestInvite):undefined);
    field(details,'Přijal podmínky',p.accepted);field(details,'Platební metoda',p.paymentMethod==='CASH'?'Platí manažer (CASH)':p.paymentMethod);
    field(details,'Uhrazeno',p.paid);field(details,'Confirmed v HMS',p.confirmed);card.append(details);
    if(p.ok)card.append(el('p','Vše je v pořádku · registrace potvrzena','ok'));
    else {const actions=el('ul',undefined,'actions');for(const action of p.actions)actions.append(el('li',action));card.append(actions);}
    $('players').append(card);
  }
}
async function loadTeam() {
  clearPlayers();message('Načítám ověřené registrace…');
  const version=requestVersion;
  try {const data=await api(admin?'admin-team':'team',{teamId:admin?selected:undefined});if(version!==requestVersion)return;display(data);message('');}
  catch(error){if(version!==requestVersion)return;message(error.message);if(error.status===401){$('admin').hidden=true;$('login').hidden=false;}}
}
function linkState() {
  clearShare();const link=catalog?.links.find(l=>l.teamId.toLowerCase()===selected);
  $('link-controls').hidden=!selected;
  $('create-link').disabled=!catalog?.sourceReady;
  $('revoke-link').disabled=!link||link.revoked;
  $('link-status').textContent=link?(link.revoked?'Odkaz byl zrušen.':Date.parse(link.expiresAt)<=Date.now()?'Platnost odkazu vypršela.':'Odkaz vytvořen '+date(link.createdAt)+' · platnost do '+date(link.expiresAt)):'Tým zatím nemá přístupový odkaz.';
}
async function loadCatalog() {
  clearPlayers();clearShare();message('Načítám týmy…');
  try {
    catalog=await api('catalog');$('login').hidden=true;$('admin').hidden=false;$('lock').hidden=false;
    $('team').replaceChildren(new Option('Vyberte tým',''));
    for(const t of catalog.teams)$('team').append(new Option(t.name+(t.players===null?'':' · '+t.players+' hráčů'),t.teamId));
    if(!catalog.teams.some(t=>t.teamId===selected))selected='';$('team').value=selected;linkState();
    message(catalog.sourceReady?'':catalog.sourceError);
    if(selected&&catalog.sourceReady)await loadTeam();
  }catch(error){message(error.message);if(error.status===401){$('login').hidden=false;$('admin').hidden=true;}}
}
$('login').onsubmit=async event=>{
  event.preventDefault();const input=$('code'),token=input.value;input.value='';
  try{await api('login',{post:true,token});await loadCatalog();}catch(error){message(error.message);}
};
$('team').onchange=async()=>{selected=$('team').value;clearPlayers();linkState();if(selected&&catalog.sourceReady)await loadTeam();};
for(const id of ['search','filter'])$(id).addEventListener('input',render);
$('refresh').onclick=loadTeam;
$('create-link').onclick=async()=>{
  if(loading||!selected)return;loading=true;const teamId=selected;$('create-link').disabled=true;$('team').disabled=true;clearShare();
  try{const data=await api('rotate',{post:true,teamId});catalog.links=catalog.links.filter(l=>l.teamId!==teamId);catalog.links.push(data.link);linkState();$('share-link').value=location.origin+data.path;$('new-link').hidden=false;message('Nový odkaz je připraven. Předchozí odkaz už neplatí. Předejte jej pouze vedoucímu tohoto týmu.');}
  catch(error){message(error.message);}finally{loading=false;$('create-link').disabled=!catalog?.sourceReady;$('team').disabled=false;}
};
$('revoke-link').onclick=async()=>{
  if(loading||!selected)return;loading=true;const teamId=selected;$('team').disabled=true;clearShare();
  try{await api('revoke',{post:true,teamId});await loadCatalog();message('Odkaz byl zrušen. Další načtení je zablokováno i v otevřených relacích.');}catch(error){message(error.message);}finally{loading=false;$('team').disabled=false;}
};
$('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('share-link').value);message('Odkaz zkopírován.');}catch{$('share-link').select();message('Odkaz označen; zkopírujte jej ručně.');}};
$('lock').onclick=async()=>{clearPlayers();clearShare();selected='';catalog=null;$('admin').hidden=true;$('link-controls').hidden=true;$('lock').hidden=true;$('title').textContent='Přehled registrací';try{await api(admin?'logout':'team-logout',{post:true});message('Přehled je zamčený.');}catch(error){message(error.message);}if(admin)$('login').hidden=false;};
if(admin){$('map').hidden=false;try{const access=await api('access');if(access.authorized)await loadCatalog();else{$('login').hidden=false;message(access.configured?'':'Interní přístup nebo databáze čekají na nastavení serveru.');}}catch(error){message(error.message);}}
else {
  try {if(invitation){const token=invitation;invitation='';await api('exchange',{post:true,token});}await loadTeam();$('lock').hidden=false;}
  catch(error){invitation='';message(error.message);}
}
