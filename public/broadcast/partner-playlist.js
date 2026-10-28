import {sponsorDisplayLogo,publicImageUrl,saveSponsorOverride} from '../sponsors/model.js';
import {readSponsorPreferences,saveSponsorPreferences} from '../sponsors/rotation.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
import {translate} from './i18n.js';
export function teamPartners(catalog,game,side='home',rules=[],partnerScope='team',{requireSelection=false}={}){
  if(!catalog?.items)return [];
  const eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
  const organization=partnerScope==='organization',scope=organization?'game':'team';
  const teamId=organization?game.ID:game[(side==='away'?'away':'home')+'Id'];if(!teamId)return [];
  const assigned=organization?catalog.items:catalog.items.filter(s=>(s.scopeRefs?.teamIds??[]).some(id=>eq(id,teamId))||(catalog.bindings??[]).some(b=>eq(b.sponsorId,s.id)&&eq(b.teamId,teamId)));
  const selected=rules.filter(r=>r.kind==='hms-sponsor'&&r.org===catalog.org&&r.scope===scope&&eq(r.targetId,teamId));
  const ordered=selected.length?selected.filter(r=>r.enabled).map(r=>{const s=assigned.find(s=>eq(s.id,r.sponsorId));return s?{...s,rule:r}:null;}).filter(Boolean):requireSelection?[]:assigned;
  return [...new Map(ordered.map(s=>[s.id,s])).values()].map(s=>({id:s.id,title:s.name,claim:s.claim??'',url:s.web??'',image:sponsorDisplayLogo(s,s.rule?.overrideUrl),showSeconds:s.rule?.showSeconds,pauseSeconds:s.rule?.pauseSeconds,kind:'sponsor',enabled:true,org:catalog.org,scope,targetId:teamId}));
}
export async function mountPartnerPlaylist(slot,{catalog,game,side,channel,onSaved,lang='cs',partnerScope='team',rotation}){
  const organization=partnerScope==='organization',scope=organization?'game':'team';
  const t=v=>esc(translate(v,lang)),teamId=organization?game.ID:game[(side==='away'?'away':'home')+'Id'];
  if(!catalog){slot.innerHTML=`<p>${t('Seznam partnerů HMS není dostupný. Zkuste Obnovit z HMS.')}</p>`;return;}
  const available=teamPartners(catalog,game,side,[],partnerScope),teamName=organization?catalog.org:game[side==='away'?'Away Team':'Home Team'];
  if(!available.length){slot.innerHTML=`<p>${t(organization?'Organizace nemá v HMS žádné sponzory.':'Vybraný tým nemá v HMS přiřazené sponzory.')}</p>`;return;}
  if(!channel?.info().ready){slot.innerHTML=`<p>${t('Pro uložení výběru a pořadí nejprve vytvořte OBS kanál.')}</p>`;return;}
  let library;try{library=await channel.library();}catch(e){slot.textContent=e.message;return;}if(!slot.isConnected)return;
  const matches=r=>r.kind==='hms-sponsor'&&r.org===catalog.org&&r.scope===scope&&r.targetId.toLowerCase()===teamId.toLowerCase();
  const refs=library.items.filter(matches),prefs=readSponsorPreferences(catalog.org,partnerScope,organization?'':teamId);
  const saved=refs.length?refs.map(r=>({...r,sponsorId:r.sponsorId})):prefs?.choices??[];
  let choices=[...saved.map(r=>({asset:available.find(a=>a.id===r.sponsorId),enabled:r.enabled,showSeconds:r.showSeconds??'',pauseSeconds:r.pauseSeconds??'',overrideUrl:r.overrideUrl??''})).filter(r=>r.asset),...available.filter(a=>!saved.some(r=>r.sponsorId===a.id)).map(asset=>({asset,enabled:false,showSeconds:'',pauseSeconds:'',overrideUrl:catalog.items.find(s=>s.id===asset.id)?.logo?.overrideUrl??''}))];
  function render(){
    slot.innerHTML=`<h3>${esc(teamName)} · ${t('Výběr a pořadí partnerů')}</h3><p>${t('Zaškrtněte partnery. Prázdný výběr znamená prázdný výstup. Vlastní časy přepíší společné hodnoty; prázdné pole je převezme.')}</p><ol class="partner-choices">${choices.map(({asset:a,enabled,showSeconds,pauseSeconds,overrideUrl},i)=>`<li><div class="partner-choice-main"><label><input type="checkbox" data-index="${i}" ${enabled?'checked':''}>${a.image?`<img src="${esc(a.image)}" alt="">`:''}<span><strong>${esc(a.title)}</strong>${a.claim?`<small>${esc(a.claim)}</small>`:''}</span></label><button class="button" type="button" data-up="${i}" ${i===0?'disabled':''}>↑</button><button class="button" type="button" data-down="${i}" ${i===choices.length-1?'disabled':''}>↓</button></div><div class="partner-times"><label>${t('Logo (s)')}<input type="number" min="1" max="300" placeholder="${rotation?.showSeconds??15}" value="${esc(showSeconds)}" data-show="${i}"></label><label>${t('Pauza bez loga (s)')}<input type="number" min="0" max="3600" placeholder="${rotation?.pauseSeconds??30}" value="${esc(pauseSeconds)}" data-pause="${i}"></label></div><details><summary>${t('Náhrada loga · veřejná HTTPS URL')}</summary><input type="url" value="${esc(overrideUrl)}" data-logo="${i}" placeholder="https://…"><small>${t('Ukládá se lokálně pro organizaci a do soukromě ovládaného kanálu. HMS se nemění.')}</small></details></li>`).join('')}</ol><button class="button primary" id="save-partners">${t('Uložit výběr a pořadí')}</button><span role="status" class="partner-save-status"></span>`;
    slot.querySelectorAll('[data-index]').forEach(el=>el.onchange=()=>choices[Number(el.dataset.index)].enabled=el.checked);
    for(const [attr,key] of [['show','showSeconds'],['pause','pauseSeconds'],['logo','overrideUrl']])slot.querySelectorAll('[data-'+attr+']').forEach(el=>el.oninput=()=>choices[Number(el.dataset[attr])][key]=el.value);
    for(const direction of ['up','down'])slot.querySelectorAll('[data-'+direction+']').forEach(el=>el.onclick=()=>{const i=Number(el.dataset[direction]),j=i+(direction==='up'?-1:1);[choices[i],choices[j]]=[choices[j],choices[i]];render();});
    slot.querySelector('#save-partners').onclick=async()=>{
      const message=slot.querySelector('.partner-save-status');
      try{
        const normalized=choices.map(c=>{const timing={};for(const [key,max,min] of [['showSeconds',300,1],['pauseSeconds',3600,0]])if(c[key]!==''){const n=Number(c[key]);if(!Number.isInteger(n)||n<min||n>max)throw new Error(translate('Zkontrolujte časy zobrazení a pauzy.',lang));timing[key]=n;}
          if(c.overrideUrl&&!publicImageUrl(c.overrideUrl))throw new Error(translate('Použijte veřejnou HTTPS URL.',lang));
          return {id:crypto.randomUUID(),kind:'hms-sponsor',org:catalog.org,scope,targetId:teamId,sponsorId:c.asset.id,enabled:c.enabled,...timing,...(c.overrideUrl?{overrideUrl:c.overrideUrl}:{})};});
        slot.querySelectorAll('button').forEach(b=>b.disabled=true);
        await channel.saveLibrary([...library.items.filter(r=>!matches(r)),...normalized],library.revision);
        saveSponsorPreferences(catalog.org,partnerScope,organization?'':teamId,{choices:normalized,rotation});
        for(const r of normalized)saveSponsorOverride(catalog.org,r.sponsorId,r.overrideUrl??'');
        onSaved();
      }catch(e){message.textContent=e.message;slot.querySelector('#save-partners').disabled=false;}
    };
  }render();
}
