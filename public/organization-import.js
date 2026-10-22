const config=JSON.parse(document.getElementById('import-config').textContent);
const form=document.getElementById('form'),button=document.getElementById('submit'),result=document.getElementById('result'),secret=document.getElementById('secret'),feedLink=document.getElementById('feed-link'),reportLink=document.getElementById('report-link');
let running=false;
window.addEventListener('beforeunload',event=>{if(running){event.preventDefault();event.returnValue='';}});
const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
async function importPage(payload,credential){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(payload)});
      let data;try{data=await response.json();}catch{const error=new Error('Server vrátil nečitelnou odpověď.');error.retryable=response.status>=500;throw error;}
      if(!response.ok){const error=new Error(data.error||'Import se nezdařil.');error.retryable=response.status>=500;throw error;}
      if(data.organization!==config.org){const error=new Error('Odpověď nepatří vybrané organizaci.');error.retryable=false;throw error;}
      return data;
    }catch(error){if(error.retryable===false||attempt===2)throw error;await wait((attempt+1)*2500);}
  }
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(running)return;
  const payload=config.batch?{from:document.getElementById('from').value,to:document.getElementById('to').value}:{gameId:document.getElementById('gameId').value.trim()};
  if(config.batch&&(!payload.from||!payload.to||payload.from>payload.to||(Date.parse(payload.to)-Date.parse(payload.from))/86400000>30)){result.className='error';result.textContent='Vyberte období nejvýše 31 kalendářních dnů.';return;}
  running=true;button.disabled=true;feedLink.hidden=true;reportLink.hidden=true;result.className='';
  for(const input of form.querySelectorAll('input'))input.disabled=true;
  let credential=secret.value;secret.value='';
  try{
    if(!config.batch){
      result.textContent='Načítám data z HMS…';const data=await importPage(payload,credential);
      result.textContent='Hotovo: '+data.score+', vzniklo '+data.priklepy+' Příklepů.';
      if(/^[a-f0-9-]{36}$/i.test(data.gameId)){reportLink.href='/game-center/'+encodeURIComponent(data.gameId)+'/public';reportLink.hidden=false;}
    }else{
      let skip=0,processed=0,failed=0,discovered=0;const failures=[];
      for(let batch=0;batch<=1000;batch++){
        result.textContent='Probíhá import '+config.org+'…\nZpracováno: '+processed+' | Chyby: '+failed;
        const data=await importPage({...payload,skip},credential);
        if(!Number.isSafeInteger(data.nextSkip)||data.nextSkip<skip||!data.done&&data.nextSkip<=skip)throw new Error('Zdroj neposunul stránku importu.');
        processed+=data.processed;failed+=data.failed;discovered+=data.discovered;failures.push(...(data.failures??[]));skip=data.nextSkip;
        if(data.done){result.textContent=(discovered?'Hotovo.':'V tomto období nejsou dokončené zápasy.')+'\nÚspěšně zpracováno: '+processed+' zápasů.\nChyby: '+failed+'.'+(failures.length?'\n'+failures.map(f=>(f.gameId||'Zápas')+' — '+f.error).join('\n'):'');break;}
        if(batch===1000)throw new Error('Dosažen limit dávek. Zvolte kratší období.');
        await wait(2500);
      }
    }
    feedLink.href=config.feed+'?refresh='+Date.now();feedLink.hidden=false;
  }catch(error){result.className='error';result.textContent=error.message+'\nImport lze bezpečně spustit znovu.';}
  finally{credential='';secret.value='';running=false;button.disabled=false;for(const input of form.querySelectorAll('input'))input.disabled=false;}
});
