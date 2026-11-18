const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy=v=>structuredClone(v);
export function mountClosing(host,{organization,secret,language=()=>new URLSearchParams(location.search).get('lang')??'cs'}){
 host.classList.add('closing-admin');
 let generation=0,instance=null,catalog=[],groups=[],data=null,config=null,dirty=false,busy=false,slug='',message='',items=[],allStars=[];
 const en=()=>language()==='en',t=(cs,english)=>en()?english:cs;
 const api=async(action,extra={},body)=>{
  const current=generation;
  const r=await fetch('/api/closing?'+new URLSearchParams({org:organization(),action,lang:en()?'en':'cs',...extra}),{method:body?'POST':'GET',headers:{authorization:'Bearer '+secret(),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  const d=await r.json();if(current!==generation)throw Error('Stale organization request');if(!r.ok)throw Error([d.error,...(d.review?.problems??[])].join(' '));return d;
 };
 const option=(id,name,value)=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`;
 const state=()=>instance?.draft;
 const last=()=>state()?.versions.at(-1);
 const teams=()=>data?.teams??last()?.teams??[];
 const players=()=>data?.players??last()?.players??[];
 const teamName=id=>teams().find(p=>p.id===id)?.name??id;
 const playerName=a=>players().find(p=>p.playerId===a.playerId&&p.teamId===a.teamId)?.name??a.playerId;
 function draw(){
  const locked=state()?.locked,scope=config?.scope,types=[['competition',t('Soutěž / sezona','Competition / season')],['group',t('Skupina','Group')],['phase',t('Fáze','Phase')]],group=groups.find(g=>g.id===scope?.groupId);
  const phases=group?.phases??groups.flatMap(g=>g.phases.map(p=>({...p,name:g.name+' · '+p.name})));
  host.innerHTML=`<nav><button data-toggle>Closing</button></nav><section class="panel" id="closing-panel"><h2>Official Closing V1</h2><p>${t('Oficiální uzavření výsledků má vlastní koncept, schválení a publikaci.','Official results have their own draft, approval and publication.')}</p>
   <div class="adminbar"><button data-load>${t('Načíst Closing','Load Closing')}</button><select data-existing aria-label="Closing"><option value="">${t('Nový záznam','New record')}</option>${items.map(i=>option(i.slug,i.title??i.slug,slug)).join('')}</select><label>${t('Identifikátor odkazu','Link identifier')}<input data-slug maxlength="64" value="${esc(slug)}" ${instance?'disabled':''}></label><button data-open>${t('Otevřít / nový','Open / new')}</button></div>
   <p role="status" aria-live="polite">${esc(message)}</p>${config?`<p>${locked?t('Uzamčeno','Locked'):t('Koncept','Draft')} · ${t('Revize','Revision')} ${instance?.revision??0} · ${t('Verze','Version')} ${state()?.versions.length??0} · ${t('Veřejná verze','Public version')} ${state()?.publishedVersion??'—'} ${dirty?' · '+t('Neuložené změny','Unsaved changes'):''}</p>
   <fieldset data-edit ${locked?'disabled':''}><label>${t('Název','Title')}<input data-title maxlength="100" value="${esc(config.title)}"></label><div class="form-grid"><label>${t('Soutěž a sezona','Competition and season')}<select data-season>${catalog.map(s=>option(s.seasonId,s.name,scope.seasonId)).join('')}</select></label><label>${t('Rozsah','Scope')}<select data-type>${types.map(([id,name])=>option(id,name,scope.type)).join('')}</select></label>
   ${scope.type!=='competition'?`<label>${t('Skupina','Group')}<select data-group>${scope.type==='phase'?option('',t('Všechny skupiny','All groups'),scope.groupId??''):''}${groups.map(g=>option(g.id,g.name,scope.groupId)).join('')}</select></label>`:''}
   ${scope.type==='phase'?`<label>${t('Fáze','Phase')}<select data-phase>${phases.map(p=>option(p.id,p.name,scope.phaseId)).join('')}</select></label>`:''}</div>
   <button data-sources>${t('Načíst podklady HMS','Load HMS sources')}</button><button data-suggest ${!data?'disabled':''}>${t('Použít navržené pořadí','Apply suggested order')}</button>
   <h3>${t('Konečné pořadí','Final standings')}</h3><p>${t('Pořadí tabulky HMS je pouze návrh. Sdílené místo zadejte stejným číslem.','HMS table order is a suggestion. Enter the same rank for joint placements.')}</p>
   <div data-rows>${config.standings.map((r,i)=>`<div class="order-row"><span>${esc(teamName(r.teamId))}</span><label>${t('Místo','Rank')}<input type="number" min="1" max="256" data-rank="${i}" value="${r.rank??''}"></label><label>${t('Medaile','Medal')}<select data-medal="${i}">${[[null,'—'],['gold',t('Zlato','Gold')],['silver',t('Stříbro','Silver')],['bronze',t('Bronz','Bronze')]].map(([id,name])=>option(id??'',name,r.medal??'')).join('')}</select></label><button data-move="${i}" data-dir="-1" ${i===0?'disabled':''}>↑</button><button data-move="${i}" data-dir="1" ${i===config.standings.length-1?'disabled':''}>↓</button></div>`).join('')}</div>
   <h3>${t('Ocenění hráčů','Player awards')}</h3><p>${t('Prázdná volba = ocenění přeskočeno. MVP, brankář a obránce jsou ruční volby.','Empty selection skips the award. MVP, goalie and defenseman are manual choices.')}</p>
   ${['points','goals','assists','mvp','goalie','defenseman',...config.awards.filter(a=>a.category.startsWith('custom:')).map(a=>a.category)].map(category=>{
    const a=config.awards.find(a=>a.category===category),value=a?a.playerId+'|'+a.teamId:'';
    const labels={points:t('Body','Points'),goals:t('Góly','Goals'),assists:t('Asistence','Assists'),mvp:'MVP',goalie:t('Brankář','Goalie'),defenseman:t('Obránce','Defenseman')};
    const nominees=data?.nominations[category]??[];
    return `<label>${esc(a?.title??labels[category]??category)}<select data-award="${esc(category)}">${option('',t('Přeskočit','Skip'),value)}${players().filter((p,i,all)=>all.findIndex(x=>x.playerId===p.playerId&&x.teamId===p.teamId)===i).filter(p=>category!=='goalie'||p.role==='goalie').map(p=>option(p.playerId+'|'+p.teamId,p.name+' · '+teamName(p.teamId)+(Number.isFinite(p[category])?' · '+p[category]:''),value)).join('')}</select></label>${nominees.length?`<p>${t('Statističtí lídři (rovnosti zachovány)','Statistical leaders (ties preserved)')}: ${nominees.map(p=>esc(playerName(p))+' ('+p.value+')').join(', ')}</p>`:''}`;
   }).join('')}
   <div class="adminbar"><input data-custom-code placeholder="${t('Kód vlastního ocenění','Custom award code')}"><input data-custom-title placeholder="${t('Název ocenění','Award title')}"><button data-custom>${t('Přidat ocenění','Add award')}</button></div>
   <label>All Stars<select data-allstars>${option('',t('Bez odkazu','No reference'),config.allStarsPublicationId??'')}${[...new Set([...allStars.map(i=>i.slug),...(config.allStarsPublicationId?[config.allStarsPublicationId]:[])])].map(id=>option(id,id,config.allStarsPublicationId)).join('')}</select></label>
   <button data-save>${t('Uložit koncept','Save draft')}</button></fieldset>
   <h3>${t('Kontrola a uzamčení','Review and lock')}</h3><div data-review><ol>${config.standings.map(r=>`<li value="${r.rank??1}">${esc(teamName(r.teamId))} ${esc(r.medal??'')}</li>`).join('')}</ol>${config.awards.map(a=>`<p>${esc(a.title??a.category)}: ${esc(playerName(a))} · ${esc(teamName(a.teamId))}</p>`).join('')}</div>
   <div class="notice">${t('Podklady: oficiální HMS tabulky a statistiky. Konečnost výsledků ani sdílená místa zdroj nepotvrzuje; posoudí je správce.','Sources: official HMS standings and statistics. Finality and joint placements require administrator review.')}
   <p>${t('Načteno','Read at')}: ${esc((data?.provenance??last()?.provenance)?.readAt??'—')}</p>
   ${Object.entries((data?.provenance??last()?.provenance)?.coverage??{}).map(([key,value])=>`<span>${esc(({membership:t('Členství týmů','Team membership'),standings:t('Oficiální pořadí','Official order'),skaters:t('Hráčské statistiky','Skater statistics'),goalies:t('Brankářské statistiky','Goalie statistics')})[key]??key)}: ${value?t('dostupné','available'):t('chybí / neúplné','missing / incomplete')} · </span>`).join('')}</div>
   <label class="check"><input type="checkbox" data-final>${t('Ověřil/a jsem konečnost a úplnost výsledků','I reviewed finality and completeness')}</label><label class="check"><input type="checkbox" data-ties>${t('Schvaluji sdílená místa a medaile','Approve joint ranks and medals')}</label><label class="check"><input type="checkbox" data-partial>${t('Beru na vědomí chybějící podklady','Acknowledge missing source coverage')}</label><label>${t('Zdůvodnění výjimky / revize','Exception / revision reason')}<textarea data-reason maxlength="1000"></textarea></label>
   <div class="adminbar"><button data-review-button ${!instance||dirty?'disabled':''}>${t('Ověřit uložený koncept','Validate saved draft')}</button><button data-approve ${!instance||locked||dirty?'disabled':''}>${t('Schválit a uzamknout novou verzi','Approve and lock new version')}</button><button data-reopen ${!locked?'disabled':''}>${t('Otevřít novou revizi','Reopen for revision')}</button><button data-delete ${!instance||state()?.versions.length?'disabled':''}>${t('Odstranit koncept','Delete draft')}</button></div>
   <h3>${t('Sdílení schválených výsledků','Share approved results')}</h3><div class="adminbar"><select data-version aria-label="${t('Verze','Version')}">${state()?.versions.map(v=>option(String(v.approval.version),'v'+v.approval.version+' · '+v.approval.approvedAt,String(state().publishedVersion??last()?.approval.version))).join('')??''}</select><button data-publish ${!state()?.versions.length?'disabled':''}>${t('Zveřejnit vybranou verzi','Publish selected version')}</button><button data-pause ${!state()?.publishedVersion?'disabled':''}>${t('Nastavit soukromé','Make private')}</button></div><p class="linkbox">${esc(location.origin+'/api/closing?'+new URLSearchParams({org:organization(),instance:slug}))}</p>`:''}</section>`;
  const $=s=>host.querySelector(s),on=(s,event,fn)=>{const el=$(s);if(el)el.addEventListener(event,fn);};
  const edit=()=>{dirty=true;$('[data-approve]').disabled=true;$('[data-review-button]').disabled=true;};
  on('[data-toggle]','click',()=>{$('#closing-panel').hidden=!$('#closing-panel').hidden;});
  on('[data-load]','click',()=>run(async()=>{const [c,list]=await Promise.all([api('catalog'),api('manage')]);catalog=c.items;items=list.items;config=null;instance=null;data=null;message=t('Vyberte záznam nebo nový identifikátor.','Select a record or enter a new identifier.');}));
  on('[data-existing]','change',e=>{$('[data-slug]').value=e.target.value;});
  on('[data-open]','click',()=>run(async()=>{slug=$('[data-slug]').value;const d=await api('manage',{instance:slug});instance=d.instance;data=null;dirty=false;
   config=copy(state()?.config??{title:slug,scope:{organization:organization(),seasonId:catalog[0]?.seasonId,competitionId:catalog[0]?.competitionId,type:'competition'},standings:[],awards:[],allStarsPublicationId:null});
   if(config){const c=await api('context',config.scope);groups=c.groups;if(!state()?.locked)try{data=await api('sources',config.scope);}catch(e){message=e.message;}}
   const current=generation;try{const r=await fetch('/api/all-stars?'+new URLSearchParams({org:organization(),action:'list'}),{signal:AbortSignal.timeout(10000)});if(r.ok){const d=await r.json();if(current===generation)allStars=d.items;}}catch{/* Optional references do not block Closing. */}
  }));
  on('[data-title]','input',e=>{config.title=e.target.value;edit();});
  async function changeScope(patch){await run(async()=>{config.scope={...config.scope,...patch};if(config.scope.type==='competition'){delete config.scope.groupId;delete config.scope.phaseId;}if(config.scope.type==='group'){config.scope.groupId||=groups[0]?.id;delete config.scope.phaseId;}if(config.scope.type==='phase'){const available=config.scope.groupId?groups.find(g=>g.id===config.scope.groupId)?.phases:groups.flatMap(g=>g.phases);if(!available?.some(p=>p.id===config.scope.phaseId))config.scope.phaseId=available?.[0]?.id;}if(!config.scope.groupId)delete config.scope.groupId;config.standings=[];config.awards=[];config.allStarsPublicationId=null;data=null;dirty=true;});}
  on('[data-season]','change',e=>run(async()=>{const s=catalog.find(s=>s.seasonId===e.target.value);config.scope={organization:organization(),seasonId:s.seasonId,competitionId:s.competitionId,type:'competition'};groups=(await api('context',config.scope)).groups;config.standings=[];config.awards=[];data=null;dirty=true;}));
  on('[data-type]','change',e=>changeScope({type:e.target.value}));on('[data-group]','change',e=>changeScope({groupId:e.target.value}));on('[data-phase]','change',e=>changeScope({phaseId:e.target.value}));
  on('[data-sources]','click',()=>run(async()=>{data=await api('sources',config.scope);if(!config.standings.length){config.standings=data.teams.map(t=>({teamId:t.id,rank:null,medal:null}));dirty=true;}}));
  on('[data-suggest]','click',()=>{config.standings=copy(data.suggestions);for(const p of data.teams)if(!config.standings.some(s=>s.teamId===p.id))config.standings.push({teamId:p.id,rank:null,medal:null});dirty=true;draw();});
  host.querySelectorAll('[data-rank]').forEach(e=>e.oninput=()=>{config.standings[+e.dataset.rank].rank=e.value?Number(e.value):null;edit();});
  host.querySelectorAll('[data-medal]').forEach(e=>e.onchange=()=>{config.standings[+e.dataset.medal].medal=e.value||null;edit();});
  host.querySelectorAll('[data-move]').forEach(e=>e.onclick=()=>{const from=+e.dataset.move,to=from+(+e.dataset.dir);[config.standings[from],config.standings[to]]=[config.standings[to],config.standings[from]];config.standings.forEach((r,i)=>r.rank=i+1);dirty=true;draw();});
  host.querySelectorAll('[data-award]').forEach(e=>e.onchange=()=>{const category=e.dataset.award,old=config.awards.find(a=>a.category===category);config.awards=config.awards.filter(a=>a.category!==category);if(e.value){const [playerId,teamId]=e.value.split('|');config.awards.push({category,playerId,teamId,...(old?.title?{title:old.title}:{})});}edit();});
  on('[data-custom]','click',()=>{const code=$('[data-custom-code]').value,title=$('[data-custom-title]').value;if(!/^[a-z0-9-]{1,40}$/.test(code)||!title.trim())return;const category='custom:'+code;if(!config.awards.some(a=>a.category===category))config.awards.push({category,title,playerId:'',teamId:''});dirty=true;draw();});
  on('[data-allstars]','change',e=>{config.allStarsPublicationId=e.target.value||null;edit();});
  const policy=()=>({confirmFinal:$('[data-final]').checked,allowTies:$('[data-ties]').checked,acceptPartial:$('[data-partial]').checked,reason:$('[data-reason]').value});
  async function mutate(action,extra={}){await run(async()=>{const d=await api(action,{instance:slug},{revision:instance?.revision??0,...extra});instance=d.instance;config=copy(state()?.config);dirty=false;message=t('Uloženo.','Saved.');});}
  on('[data-save]','click',()=>mutate('save',{config:{...config,awards:config.awards.filter(a=>a.playerId)}}));
  on('[data-approve]','click',()=>mutate('approve',{policy:policy()}));
  on('[data-review-button]','click',()=>{const p=policy();run(async()=>{const d=await api('review',{instance:slug},{revision:instance.revision,policy:p});message=d.review.problems.join(' ')||t('Ověřeno.','Validated.');});});
  on('[data-reopen]','click',()=>mutate('reopen',{reason:$('[data-reason]').value}));
  on('[data-publish]','click',()=>mutate('publish',{version:Number($('[data-version]').value)}));
  on('[data-pause]','click',()=>mutate('pause'));on('[data-delete]','click',()=>mutate('delete'));
 }
 async function run(fn){if(busy)return;const current=generation;busy=true;host.querySelectorAll('button,input,select,textarea').forEach(e=>e.disabled=true);try{await fn();}catch(e){if(current===generation)message=e.message;}finally{if(current===generation){busy=false;draw();}}}
 draw();return {reset(){generation++;busy=false;instance=null;config=null;data=null;catalog=[];groups=[];items=[];slug='';message='';draw();}};
}
