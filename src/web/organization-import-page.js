import {isGameId} from '../domain/game-summary.js';
import {organizationConfig} from '../app/organizations.js';
import {timeWindow} from '../app/media-engine.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createOrganizationImportPage({batch=false,env,now}={}){
  return (request,response)=>{
    response.setHeader('content-type','text/html; charset=utf-8');
    response.setHeader('cache-control','no-store');
    response.setHeader('x-robots-tag','noindex, nofollow');
    response.setHeader('referrer-policy','no-referrer');
    if(request.method!=='GET')return response.status(405).send('Method not allowed');
    let org;
    try{org=organizationConfig(request.query?.org??'PHM',env??process.env);}catch{return response.status(404).send('Organizace není dostupná nebo nemá nastavené připojení.');}
    const query=new URLSearchParams({org:org.code}),today=timeWindow('Today',now).from,from=timeWindow('Past',now).from;
    const suffix=org.code==='PHM'?'':'/'+org.slug;
    const gameId=isGameId(request.query?.gameId)?request.query.gameId:'';
    const config=JSON.stringify({org:org.code,batch,endpoint:'/api/admin/'+(batch?'backfill':'import-game')+'?'+query,feed:'/priklepy'+suffix}).replace(/</g,'\\u003c');
    return response.status(200).send(`<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" sizes="32x32" href="/hms-favicon-32.png"><title>Import · ${escape(org.name)}</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#080f1b;color:#eef3fa}*{box-sizing:border-box}body{margin:0;padding:24px;min-height:100vh;display:grid;place-items:center}main{width:min(600px,100%);padding:26px;background:#121d2c;border:1px solid #304159;border-radius:18px}h1{font-size:25px;margin-top:8px}.org{color:#78e5b8;font-weight:800;letter-spacing:1px}p,small{color:#adbdcf;line-height:1.6}label{display:block;font-weight:700;margin:18px 0 7px}input,button{font:inherit;width:100%;padding:13px;border-radius:9px;min-height:44px}input{background:#0a1320;border:1px solid #40546b;color:white}button{cursor:pointer;background:#78e5b8;color:#102030;font-weight:800;border:0;margin-top:20px}button:disabled{opacity:.5;cursor:wait}#result{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;margin-top:22px}.error{color:#ff9e9e}a{color:#78e5b8}nav{display:flex;gap:20px;flex-wrap:wrap;margin-top:24px}small{display:block;margin-top:18px}[hidden]{display:none!important}</style></head><body><main>
<div class="org">${escape(org.name)}</div><h1>${batch?'Historický import zápasů':'Import jednoho zápasu'}</h1>
<p>${batch?'Načte dokončené zápasy této organizace ve zvoleném období a vytvoří Příklepy. Import postupuje po jednom zápase; stránku během běhu nezavírejte.':'Načte jeden dokončený zápas této organizace a vytvoří Příklepy.'}</p>
<form id="form">${batch?`<label for="from">Od</label><input id="from" type="date" required value="${from}" max="${today}"><label for="to">Do (včetně)</label><input id="to" type="date" required value="${today}" max="${today}"><small>Nejvýše 31 kalendářních dnů v jednom běhu.</small>`:`<label for="gameId">HMS Game ID</label><input id="gameId" value="${escape(gameId)}" required autocomplete="off">`}
<label for="secret">Signing secret · ${escape(org.name)}</label><input id="secret" required type="password" autocomplete="off" placeholder="Signing secret z HMS pro tuto organizaci">
<small>API token sem nepatří. Signing secret se neukládá; použije se v ověřovacím HTTPS požadavku a po běhu se smaže z pole.</small><button id="submit">${batch?'Spustit historický import':'Načíst a zpracovat zápas'}</button></form>
<div id="result" role="status"></div><p><a id="feed-link" href="/priklepy${suffix}" hidden>Otevřít Příklepy ${escape(org.name)} →</a></p><p><a id="report-link" hidden>Otevřít Game Report →</a></p>
<nav><a href="/admin/${batch?'import-game':'backfill'}?${query}">${batch?'Import jednoho zápasu':'Historický import'}</a><a href="/studio/${org.slug}">Studio ${escape(org.name)}</a></nav>
<small>Import nic nemění v HMS. Opakování aktualizuje uložený snapshot a přepočítá Příklepy daného zápasu.</small>
<script type="application/json" id="import-config">${config}</script><script src="/organization-import.js" defer></script></main></body></html>`);
  };
}
