const select=document.querySelector('#catalog-org'),body=document.querySelector('#catalog-body'),status=document.querySelector('#catalog-status'),button=document.querySelector('#catalog-refresh');
const query=new URLSearchParams(location.search);select.value=['PHM','EUCHL'].includes(query.get('org'))?query.get('org'):'PHM';
const cell=(row,text)=>{const td=document.createElement('td');td.textContent=text??'—';row.append(td);return td;};
const scopeLabels={competitionIds:'Soutěže',seasonIds:'Sezony',groupIds:'Skupiny',phaseIds:'Fáze',venueIds:'Stadiony'};
let loading=false;
async function load(){
  if(loading)return;loading=true;button.disabled=select.disabled=true;body.replaceChildren();status.textContent='Načítám sponzory…';
  const org=select.value;document.querySelector('#studio-link').href='/broadcast/?org='+encodeURIComponent(org);const url=new URL(location.href);url.searchParams.set('org',org);history.replaceState(null,'',url);
  try{
    const response=await fetch('/api/broadcast?'+new URLSearchParams({org,catalog:'sponsors'}),{cache:'no-store',signal:AbortSignal.timeout(16000)}),data=await response.json();
    if(!response.ok)throw new Error(data.error??'HMS nyní není dostupné.');if(data.org!==org||!Array.isArray(data.items))throw new Error('Odpověď neodpovídá organizaci.');
    const teams=new Map(data.teams.map(t=>[t.id,t.name]));
    for(const sponsor of data.items){
      const row=document.createElement('tr'),logo=cell(row,'');
      if(sponsor.logoUrl){const image=document.createElement('img');image.src=sponsor.logoUrl;image.alt=sponsor.name;logo.append(image);}else logo.textContent='Bez loga';
      cell(row,sponsor.name);cell(row,sponsor.claim);
      const web=cell(row,'—');if(sponsor.web){const u=new URL(sponsor.web);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password){const a=document.createElement('a');a.href=u.href;a.textContent=u.hostname;a.target='_blank';a.rel='noopener noreferrer';web.replaceChildren(a);}}
      const ids=new Set([...(sponsor.scopeRefs?.teamIds??[]),...data.bindings.filter(b=>b.sponsorId===sponsor.id).map(b=>b.teamId)]);
      cell(row,[...ids].map(id=>teams.get(id)??'Tým '+id.slice(0,8)).join(', ')||'Bez vrácené vazby na tým');
      cell(row,Object.entries(scopeLabels).filter(([key])=>sponsor.scopeRefs?.[key]?.length).map(([key,label])=>label+': '+sponsor.scopeRefs[key].length).join(' · ')||'Bez dalších vrácených vazeb');body.append(row);
    }
    status.textContent=data.items.length?`${org} · sponzoři: ${data.items.length} · týmová přiřazení: ${data.bindings.length} · načteno ${new Date(data.readAt).toLocaleString('cs-CZ')}`:`${org} · API odpovědělo, ale vrátilo prázdný seznam sponzorů.`;
    if(!data.teamsAvailable)status.textContent+=' Seznam týmů není dostupný; přiřazení nelze úplně ověřit.';
  }catch(error){status.textContent=error.name==='TimeoutError'?'HMS neodpovědělo včas. Zkuste obnovení.':error.message;}
  finally{loading=false;button.disabled=select.disabled=false;}
}
button.onclick=load;select.onchange=load;load();
