import {fetchSponsorCatalog,withSponsorOverrides,sponsorDisplayLogo,saveSponsorOverride} from '../sponsors/model.js';
const select=document.querySelector('#catalog-org'),body=document.querySelector('#catalog-body'),status=document.querySelector('#catalog-status'),button=document.querySelector('#catalog-refresh');
const query=new URLSearchParams(location.search);select.value=['PHM','EUCHL'].includes(query.get('org'))?query.get('org'):'PHM';
const cell=(row,text)=>{const td=document.createElement('td');td.textContent=text??'—';row.append(td);return td;};
const scopeLabels={competitionIds:'Soutěže',seasonIds:'Sezony',groupIds:'Skupiny',phaseIds:'Fáze',venueIds:'Stadiony'};
let loading=false;
async function load(){
  if(loading)return;loading=true;button.disabled=select.disabled=true;body.replaceChildren();status.textContent='Načítám sponzory…';
  const org=select.value;document.querySelector('#studio-link').href='/broadcast/?org='+encodeURIComponent(org);const url=new URL(location.href);url.searchParams.set('org',org);history.replaceState(null,'',url);
  try{
    const data=withSponsorOverrides(await fetchSponsorCatalog(org));
    const teams=new Map(data.teams.map(t=>[t.id,t.name]));
    for(const sponsor of data.items){
      const row=document.createElement('tr'),logo=cell(row,'');
      if(sponsorDisplayLogo(sponsor)){const image=document.createElement('img');image.src=sponsorDisplayLogo(sponsor);image.onerror=()=>{image.remove();logo.prepend(document.createTextNode('Logo není dostupné. '));};image.alt=sponsor.name;logo.append(image);}else logo.textContent='Bez loga';
      const source=document.createElement('small');source.textContent=sponsor.logo?.originalUrl?'Původní soubor HMS':'Původní soubor API nevrátilo';logo.append(source);
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Místní náhrada loga';details.append(summary);const input=document.createElement('input');input.type='url';input.placeholder='Veřejná HTTPS URL';input.value=sponsor.logo?.overrideUrl??'';const save=document.createElement('button');save.className='button';save.textContent='Uložit';const note=document.createElement('small');save.onclick=()=>{try{saveSponsorOverride(org,sponsor.id,input.value.trim());note.textContent='Uloženo v tomto prohlížeči pro tuto organizaci. Obnovte Studio.';}catch{note.textContent='Použijte veřejnou HTTPS URL.';}};details.append(input,save,note);logo.append(details);
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
