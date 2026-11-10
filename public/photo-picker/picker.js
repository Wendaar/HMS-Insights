import {photoChoice} from './model.js';
export function openPhotoPicker({org,playerId,name='',hmsUrl=null}){
  if(!org || !/^[a-f0-9-]{36}$/i.test(playerId || ''))return Promise.reject(Error('Nejdříve vyberte konkrétního hráče.'));
  if(!document.querySelector('link[data-photo-picker]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/photo-picker/style.css';css.dataset.photoPicker='1';document.head.append(css);}
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='person-photo-picker';
    const element=(tag,label)=>{const e=document.createElement(tag);if(label)e.textContent=label;return e;};
    const title=element('h2','Fotografie · '+name),notice=element('p','Vyberte zdroj fotografie. Volba mění pouze tuto grafiku, nikoli profil v HMS.');notice.setAttribute('role','status');
    let finished=false;const finish=value=>{if(finished)return;finished=true;dialog.close();dialog.remove();resolve(value);};
    const button=(label,fn)=>{const b=element('button',label);b.type='button';b.onclick=fn;return b;};
    const safeAction=fn=>async()=>{try{await fn();}catch(e){notice.textContent=e.message;}};
    const picture=(url,label)=>{const img=element('img');img.alt=label;img.loading='lazy';img.src=url?.startsWith('data:image/')?url:'/api/studio-image?'+new URLSearchParams({url});return img;};
    const primary=element('section');primary.append(element('h3','1 · Profilová fotografie z HMS'));if(hmsUrl)primary.append(picture(hmsUrl,name));primary.append(button('Použít HMS profilovku',()=>finish({source:'hms'})));
    const archive=element('section');archive.append(element('h3','2 · Schválené fotky tohoto hráče'));
    const grid=element('div');grid.className='picker-photo-grid';
    async function request(action,body,bearer){const r=await fetch('/api/photo-archive?'+new URLSearchParams({org,action,...(action==='player-photos'?{playerId}:{})}),{method:body || action==='session'?'POST':'GET',credentials:'same-origin',headers:{...(body?{'content-type':'application/json'}:{}),...(bearer?{authorization:'Bearer '+bearer}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error || 'Archiv není dostupný.');return data;}
    async function load(){grid.replaceChildren();const data=await request('player-photos');if(finished)return;if(data.org.toLowerCase()!==org.toLowerCase() || data.playerId.toLowerCase()!==playerId.toLowerCase())throw Error('Archiv neodpovídá hráči nebo organizaci.');
      for(const photo of data.photos){const choice=photoChoice({source:'archive',photoId:photo.id,url:photo.previewUrl || photo.thumbnailUrl}),b=button(`${photo.gameTitle} · ${(photo.playedOn || '').slice(0,10)} · použít fotku`,()=>finish(choice));b.prepend(picture(choice.url,name));grid.append(b);}
      notice.textContent=data.photos.length?`Schválené fotografie: ${data.photos.length}.`:'Hráč zatím nemá schválené fotografie v archivu.';
    }
    const unlock=element('div'),code=element('input');code.type='password';code.placeholder='Kód Operations této organizace';code.setAttribute('aria-label','Kód Operations této organizace');code.autocomplete='current-password';unlock.className='picker-unlock';
    unlock.append(code,button('Odemknout archiv',safeAction(async()=>{const value=code.value;code.value='';await request('session',null,value);await load();})));
    archive.append(button('Načíst schválené fotky',safeAction(load)),unlock,grid);
    const upload=element('section');upload.append(element('h3','3 · Vlastní fotografie'));
    const input=element('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','Nahrát vlastní fotografii');
    input.onchange=safeAction(async()=>{const file=input.files[0];if(!file)return;if(file.size>8*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Použijte JPG, PNG nebo WebP do 8 MB.');
      const image=await createImageBitmap(file);try{if(image.width*image.height>40000000)throw Error('Fotografie je příliš velká.');const canvas=document.createElement('canvas'),scale=Math.min(1,512/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);let url=canvas.toDataURL('image/jpeg',.82);if(url.length>180000)url=canvas.toDataURL('image/jpeg',.5);finish(photoChoice({source:'upload',url}));}finally{image.close();}});
    upload.append(input);dialog.append(title,notice,primary,archive,upload,button('Zavřít',()=>finish(null)));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});document.body.append(dialog);dialog.showModal();
  });
}
