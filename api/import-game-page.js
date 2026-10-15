const html = `<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HMS Insights – import zápasu</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#080b10;color:#f4f7fb}
    body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(560px,100%);background:#121821;border:1px solid #293442;border-radius:18px;padding:28px;box-sizing:border-box}
    h1{margin:0 0 8px;font-size:25px}p{color:#aab5c4;line-height:1.5}
    label{display:block;margin:18px 0 7px;font-weight:700;font-size:14px}
    input,button{width:100%;box-sizing:border-box;border-radius:10px;padding:13px 14px;font:inherit}
    input{background:#0b1017;color:#fff;border:1px solid #344152}
    button{margin-top:20px;border:0;background:#dfff45;color:#101400;font-weight:900;cursor:pointer}
    button:disabled{opacity:.55;cursor:wait}#result{min-height:24px;margin-top:18px;color:#dfff45;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.45 ui-monospace,monospace}.error{color:#ff8794!important}
    small{display:block;color:#718096;margin-top:15px;line-height:1.45}
  </style>
</head>
<body><main>
  <h1>Import jednoho zápasu</h1>
  <p>Bezpečný kontrolní import z HMS do databáze Příklepů.</p>
  <form id="form">
    <label for="gameId">HMS Game ID</label>
    <input id="gameId" required value="F6312E3A-98CA-11F1-8BDF-EF2495D048F3" autocomplete="off">
    <label for="secret">Webhook secret</label>
    <input id="secret" required type="password" autocomplete="off" placeholder="Vlož stejný secret jako ve Vercelu">
    <button id="submit">Načíst a zpracovat zápas</button>
  </form>
  <pre id="result" role="status"></pre>
  <small>Secret se neukládá do stránky ani do URL. Odešle se pouze přes HTTPS pro ověření tohoto požadavku.</small>
</main><script>
const form=document.querySelector('#form'),button=document.querySelector('#submit'),result=document.querySelector('#result');
form.addEventListener('submit',async(event)=>{
  event.preventDefault();button.disabled=true;result.className='';result.textContent='Načítám data z HMS…';
  const secret=document.querySelector('#secret');
  try{
    const response=await fetch('/api/admin/import-game',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+secret.value},body:JSON.stringify({gameId:document.querySelector('#gameId').value.trim()})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Import se nezdařil.');
    result.textContent='Hotovo: '+data.score+', vzniklo '+data.priklepy+' Příklepů.\\n\\nDIAGNOSTIKA STRUKTURY:\\n'+JSON.stringify(data.diagnostics,null,2);secret.value='';
  }catch(error){result.className='error';result.textContent=error.message}finally{button.disabled=false}
});
</script></body></html>`;

export default function handler(request, response) {
  if (request.method !== "GET") return response.status(405).send("Method not allowed");
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-robots-tag", "noindex, nofollow");
  return response.status(200).send(html);
}
