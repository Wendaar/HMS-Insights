const html = `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HMS Insights – historický import</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#080b10;color:#f4f7fb}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(600px,100%);background:#121821;border:1px solid #293442;border-radius:18px;padding:28px;box-sizing:border-box}
    h1{margin:0 0 8px;font-size:25px}p{color:#aab5c4;line-height:1.5}
    label{display:block;margin:18px 0 7px;font-weight:700;font-size:14px}
    input,select,button{width:100%;box-sizing:border-box;border-radius:10px;padding:13px 14px;font:inherit}
    input,select{background:#0b1017;color:#fff;border:1px solid #344152}
    button{margin-top:20px;border:0;background:#dfff45;color:#101400;font-weight:900;cursor:pointer}
    button:disabled{opacity:.55;cursor:wait}#result{min-height:48px;margin-top:18px;color:#dfff45;white-space:pre-wrap;line-height:1.5}.error{color:#ff8794!important}
    #feed-link{display:none;margin-top:12px;color:#dfff45;font-weight:800}
    small{display:block;color:#718096;margin-top:15px;line-height:1.45}
  </style>
</head>
<body><main>
  <h1>Historický import zápasů</h1>
  <p>Postupně načte všechny dokončené zápasy PHM od zvoleného data. Stránku během importu nezavírej.</p>
  <form id="form">
    <label for="season">Soutěž a sezona</label>
    <select id="season" required>
      <option value="E6134160-47CF-11F1-A223-BFDFBDD3A64B">PHM Cup – 2026/2027</option>
    </select>
    <label for="from">Načíst zápasy od</label>
    <input id="from" required type="date" value="2026-09-01">
    <label for="secret">Webhook secret</label>
    <input id="secret" required type="password" autocomplete="off" placeholder="Vlož stejný secret jako ve Vercelu">
    <button id="submit">Spustit historický import</button>
  </form>
  <div id="result" role="status"></div>
  <a id="feed-link" href="/priklepy">Otevřít Příklepy →</a>
  <small>Import probíhá bezpečně po jednom zápase. Opakované spuštění je bezpečné a existující zápasy pouze přepočítá.</small>
</main><script>
const form=document.querySelector('#form'),button=document.querySelector('#submit'),result=document.querySelector('#result'),feedLink=document.querySelector('#feed-link');
const wait=(milliseconds)=>new Promise((resolve)=>setTimeout(resolve,milliseconds));
async function loadBatch(payload,secret){
  let lastError;
  for(let attempt=1;attempt<=3;attempt+=1){
    try{
      const response=await fetch('/api/admin/backfill',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+secret},body:JSON.stringify(payload)});
      const text=await response.text();
      let data;
      try{data=JSON.parse(text)}catch{throw new Error(response.ok?'Server vrátil nečitelnou odpověď.':'Vercel dočasně přerušil zpracování zápasu.')}
      if(!response.ok)throw new Error(data.error||'Historický import se nezdařil.');
      return data;
    }catch(error){
      lastError=error;
      if(attempt<3)await wait(attempt*2500);
    }
  }
  throw lastError;
}
form.addEventListener('submit',async(event)=>{
  event.preventDefault();button.disabled=true;feedLink.style.display='none';result.className='';
  const secret=document.querySelector('#secret'),from=document.querySelector('#from').value,seasonId=document.querySelector('#season').value;
  let skip=0,processed=0,failed=0,batches=0,failureDetails=[];
  try{
    while(true){
      result.textContent='Probíhá import…\\nZpracováno: '+processed+' | Chyby: '+failed+' | Načítám od pozice: '+skip;
      const data=await loadBatch({from,seasonId,skip},secret.value);
      processed+=data.processed;failed+=data.failed;batches+=1;skip=data.nextSkip;failureDetails.push(...(data.failures||[]));
      if(data.done)break;
      if(batches>1000)throw new Error('Import byl zastaven kvůli neobvykle vysokému počtu dávek.');
      // /games + game + gameEvents + gameLineup = four HMS requests per loop.
      // This pause leaves comfortable room below 120 requests/token/minute.
      await wait(2500);
    }
    const details=failureDetails.length?'\\n\\nCHYBNÉ ZÁPASY:\\n'+failureDetails.map((item)=>item.gameId+' — '+item.error).join('\\n'):'';
    result.textContent='Hotovo.\\nÚspěšně zpracováno: '+processed+' zápasů.\\nChyby: '+failed+'.'+details;feedLink.style.display='inline-block';secret.value='';
  }catch(error){result.className='error';result.textContent=error.message+'\\nImport lze bezpečně spustit znovu.'}finally{button.disabled=false}
});
</script></body></html>`;

export default function handler(request, response) {
  if (request.method !== "GET") return response.status(405).send("Method not allowed");
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-robots-tag", "noindex, nofollow");
  return response.status(200).send(html);
}
