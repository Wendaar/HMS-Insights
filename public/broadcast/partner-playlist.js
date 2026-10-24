const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {translate} from './i18n.js';
export function teamPartners(catalog,game,side='home',rules=[]){
  if(!catalog?.items)return [];
  const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
  const teamId=game[(side==='away'?'away':'home')+'Id'];if(!teamId)return [];
  const assigned=catalog.items.filter(s=>(s.scopeRefs?.teamIds??[]).some(id=>eq(id,teamId))||(catalog.bindings??[]).some(b=>eq(b.sponsorId,s.id)&&eq(b.teamId,teamId)));
  const selected=rules.filter(r=>r.kind==='hms-sponsor'&&r.org===catalog.org&&r.scope==='team'&&eq(r.targetId,teamId));
  const ordered=selected.length?selected.filter(r=>r.enabled).map(r=>assigned.find(s=>eq(s.id,r.sponsorId))).filter(Boolean):assigned;
  return [...new Map(ordered.map(s=>[s.id,s])).values()].map(s=>({id:s.id,title:s.name,claim:s.claim??'',url:s.web??'',image:s.logoUrl,kind:'sponsor',enabled:true,org:catalog.org,scope:'team',targetId:teamId}));
}
export async function mountPartnerPlaylist(slot,{catalog,game,side,channel,onSaved,lang='cs'}){
  const t=v=>esc(translate(v,lang)),teamId=game[(side==='away'?'away':'home')+'Id'];
  if(!catalog){slot.innerHTML=`<p>${t('Seznam partnerů HMS není dostupný. Zkuste Obnovit z HMS.')}</p>`;return;}
  const available=teamPartners(catalog,game,side),teamName=game[side==='away'?'Away Team':'Home Team'];
  if(!available.length){slot.innerHTML=`<p>${t('Vybraný tým nemá v HMS přiřazené sponzory.')}</p>`;return;}
  if(!channel?.info().ready){slot.innerHTML=`<p>${t('Pro uložení výběru a pořadí nejprve vytvořte OBS kanál.')}</p>`;return;}
  let library;try{library=await channel.library();}catch(e){slot.textContent=e.message;return;}if(!slot.isConnected)return;
  const refs=library.items.filter(r=>r.kind==='hms-sponsor'&&r.org===catalog.org&&r.targetId.toLowerCase()===teamId.toLowerCase());
  let choices=[...refs.map(r=>({asset:available.find(a=>a.id===r.sponsorId),enabled:r.enabled})).filter(r=>r.asset),...available.filter(a=>!refs.some(r=>r.sponsorId===a.id)).map(asset=>({asset,enabled:refs.length===0}))];
  function render(){
    slot.innerHTML=`<h3>${esc(teamName)} · ${t('Výběr a pořadí partnerů')}</h3><p>${t('Ukládá se pro tento tým a vysílací kanál. Názvy, loga, claimy a vazby se přebírají z HMS.')}</p><ol class="partner-choices">${choices.map(({asset:a,enabled},i)=>`<li><label><input type="checkbox" data-index="${i}" ${enabled?'checked':''}>${a.image?`<img src="${esc(a.image)}" alt="">`:''}<span>${esc(a.title)}</span></label><button class="button" type="button" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="button" type="button" data-down="${i}" ${i===choices.length-1?'disabled':''}>↓</button></li>`).join('')}</ol><button class="button primary" id="save-partners">${t('Uložit výběr a pořadí')}</button><span role="status" class="partner-save-status"></span>`;
    slot.querySelectorAll('[data-index]').forEach(el=>el.onchange=()=>choices[Number(el.dataset.index)].enabled=el.checked);
    for(const direction of ['up','down'])slot.querySelectorAll('[data-'+direction+']').forEach(el=>el.onclick=()=>{const i=Number(el.dataset[direction]),j=i+(direction==='up'?-1:1);[choices[i],choices[j]]=[choices[j],choices[i]];render();});
    slot.querySelector('#save-partners').onclick=async()=>{
      slot.querySelectorAll('button').forEach(b=>b.disabled=true);
      const retained=library.items.filter(r=>!(r.kind==='hms-sponsor'&&r.org===catalog.org&&r.targetId.toLowerCase()===teamId.toLowerCase()));
      try{await channel.saveLibrary([...retained,...choices.map(({asset:a,enabled})=>({id:crypto.randomUUID(),kind:'hms-sponsor',org:catalog.org,scope:'team',targetId:teamId,sponsorId:a.id,enabled}))],library.revision);onSaved();}
      catch(e){slot.querySelector('.partner-save-status').textContent=e.message;slot.querySelector('#save-partners').disabled=false;}
    };
  }render();
}
