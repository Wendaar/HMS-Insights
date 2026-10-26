import {esc} from './extra-layers.js';
import {translate} from './i18n.js';
export async function readPublicLibrary(api,id){
  if(!/^[a-f0-9]{48}$/.test(id??''))return [];
  const url=new URL(api,location.origin);url.search=new URLSearchParams({channel:id,library:'1'});
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Knihovna není dostupná.');
  const value=await response.json();return value.items??[];
}
async function uploadImage(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>260000)throw new Error('Použijte PNG, JPEG nebo WebP do 250 kB.');
  const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const image=new Image();image.src=url;await image.decode();
  if(image.width>4096||image.height>4096||!image.width||!image.height)throw new Error('Obrázek může mít nejvýše 4096 × 4096 pixelů.');return url;
}
export async function mountLibrary(slot,{channel,org,game,lang='cs',onSaved}){
  const t=v=>esc(translate(v,lang));
  if(!channel?.info().ready){slot.innerHTML=`<p>${t('Pro knihovnu nejprve vytvořte nebo připojte OBS kanál.')}</p>`;return;}
  slot.innerHTML=`<p>${t('Načítám knihovnu…')}</p>`;
  let value;
  try{value=await channel.library();}catch(e){if(slot.isConnected)slot.textContent=translate(e.message,lang);return;}
  if(!slot.isConnected)return;
  const items=value.items;
  slot.innerHTML=`<p>${t('Toto jsou pouze doplňky tohoto kanálu, nikoli centrální katalog organizace. Existujícího partnera vyberte z HMS; zde přidejte hotové QR nebo mimořádný podklad. Omezení na organizaci, tým či zápas platí jen uvnitř tohoto kanálu.')}</p>
    <ul class="library-list">${items.filter(a=>a.kind!=='hms-sponsor').map(a=>`<li><img src="${esc(a.image)}" alt=""><div><strong>${esc(a.title)}</strong><small>${esc(a.org)} · ${t(a.kind==='cta'?'QR výzva':'Partner')} · ${t({organization:'Organizace',team:'Tým',game:'Zápas'}[a.scope])} ${a.targetId?esc(a.targetId.slice(0,8)):''}</small></div><button class="button" type="button" data-toggle="${a.id}">${t(a.enabled?'Vypnout':'Zapnout')}</button><button class="button" type="button" data-delete="${a.id}">${t('Odstranit')}</button></li>`).join('')}</ul>
    <form class="library-form"><label>${t('Typ')}<select name="kind"><option value="cta">${t('QR výzva')}</option><option value="sponsor">${t('Partner')}</option></select></label><label>${t('Platí pro')}<select name="scope"><option value="organization">${esc(org)} · ${t('Organizace')}</option>${game?`<option value="home">${esc(game['Home Team'])}</option><option value="away">${esc(game['Away Team'])}</option><option value="game">${t('Tento zápas')}</option>`:''}</select></label>
    <label>${t('Název / výzva')}<input name="title" maxlength="100" required placeholder="${t('Sledujte nás')}"></label><label>${t('Text / claim')}<input name="claim" maxlength="180"></label><label>${t('Cílový odkaz (https)')}<input name="url" type="url" pattern="https://.*" maxlength="1000" placeholder="https://…"></label><label>${t('QR kód / logo (PNG, JPEG, WebP do 250 kB)')}<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required></label><p>${t('Nahrajte hotový QR kód. Odkaz slouží jako popisek; obsah QR kódu se nepřepisuje. Bezpečný bílý okraj QR kódu zachovejte už v obrázku.')}</p><button class="button primary">${t('Přidat a uložit')}</button></form><p role="status" class="library-status"></p>`;
  let saving=false;
  async function save(next){
    if(saving)return;saving=true;slot.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await channel.saveLibrary(next,value.revision);onSaved();}
    catch(e){slot.querySelector('.library-status').textContent=translate(e.message,lang);slot.querySelectorAll('button').forEach(b=>b.disabled=false);}
    finally{saving=false;}
  }
  slot.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>save(items.filter(a=>a.id!==b.dataset.delete)));
  slot.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>save(items.map(a=>a.id===b.dataset.toggle?{...a,enabled:!a.enabled}:a)));
  slot.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(saving)return;
    try{
      const data=new FormData(event.target),selection=data.get('scope'),scope=['home','away'].includes(selection)?'team':selection;
      const image=await uploadImage(data.get('image'));
      const item={id:crypto.randomUUID(),org,kind:data.get('kind'),scope,targetId:scope==='team'?game[selection+'Id']:scope==='game'?game.ID:'',title:data.get('title'),claim:data.get('claim'),url:data.get('url'),image,enabled:true};
      if(scope==='team'&&!item.targetId)throw new Error('Chybí identifikátor týmu z HMS.');
      await save([...items,item]);
    }catch(e){slot.querySelector('.library-status').textContent=translate(e.message,lang);}
  };
}
