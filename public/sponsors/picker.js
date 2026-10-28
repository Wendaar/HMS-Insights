import {fetchSponsorCatalog,sponsorSearch,sponsorDisplayLogo,withSponsorOverrides} from './model.js';
export function mountSponsorPicker(slot,{t=value=>value,onSelect}){
  const label=document.createElement('label');label.textContent=t('Vybrat partnera z HMS');
  const search=document.createElement('input');search.type='search';search.maxLength=120;search.placeholder=t('Hledat partnera…');search.id='sponsorSearch';label.append(search);
  const select=document.createElement('select');select.id='sponsorId';select.setAttribute('aria-label',t('Vybrat partnera z HMS'));
  const info=document.createElement('p');info.className='muted';info.id='sponsorInfo';info.setAttribute('role','status');
  const reload=document.createElement('button');reload.type='button';reload.textContent=t('Obnovit partnery z HMS');
  const apply=document.createElement('button');apply.type='button';apply.textContent=t('Použít údaje partnera znovu');
  slot.replaceChildren(label,select,info,apply,reload);
  let items=[],org='',selected='',version=0,controller;
  function render(){
    select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=t('Vlastní partner / vyberte z HMS');select.append(empty);
    for(const s of sponsorSearch(items,search.value)){const option=document.createElement('option');option.value=s.id;option.textContent=s.name;select.append(option);}
    if(selected&&!Array.from(select.options).some(o=>o.value===selected)){const s=items.find(i=>i.id===selected);if(s){const option=document.createElement('option');option.value=s.id;option.textContent=s.name;select.append(option);}}
    select.value=selected;apply.disabled=!items.some(s=>s.id===selected);
  }
  function describe(){const item=items.find(s=>s.id===selected);if(item)info.textContent=t(item.logo?.overrideUrl?'Používá se náhrada loga.':item.logo?.originalUrl?'Používá se původní logo z HMS.':'HMS nevrátilo původní logo. Logo lze ručně nahradit URL nebo uploadem.');}
  select.addEventListener('change',()=>{selected=select.value;const item=items.find(s=>s.id===selected)??null;onSelect(item?{...item,selectedLogo:sponsorDisplayLogo(item),organization:org}:null);render();describe();});
  search.addEventListener('input',render);apply.onclick=()=>{const item=items.find(s=>s.id===selected);if(item)onSelect({...item,selectedLogo:sponsorDisplayLogo(item),organization:org});};
  async function load(nextOrg){
    org=nextOrg;const id=++version;controller?.abort();controller=new AbortController();items=[];selected='';search.value='';render();select.disabled=true;info.textContent=t('Načítám partnery z HMS…');
    try{const data=withSponsorOverrides(await fetchSponsorCatalog(org,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(16000)])}));if(id!==version)return;items=data.items;info.textContent=t(items.length?'Vyberte partnera; text i logo můžete dále upravit.':'HMS pro tuto organizaci nemá dostupné partnery.');render();}
    catch{if(id===version)info.textContent=t('Partnery se nepodařilo načíst. Ruční zadání zůstává dostupné.');}
    finally{if(id===version)select.disabled=false;}
  }
  reload.onclick=()=>{const old=selected,expected=version+1;load(org).then(()=>{if(version!==expected)return;selected=old;render();describe();});};
  return {async load(nextOrg,id=''){const expected=version+1;await load(nextOrg);if(version!==expected)return;selected=id;render();describe();},setSelected(id){selected=id;render();describe();}};
}
