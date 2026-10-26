// Verified thread destinations only; this registry contains no conversation content.
export const workChats={
 broadcast:{kind:'codex',id:'01a165c4-e60e-72d1-b153-1dc4f418af12',title:'HMS Control Center for OBS V1',topic:'OBS vrstvy, sponzoři, ovládání a výstupy přenosu.'},
 games:{kind:'codex',id:'01a15508-2cbe-7d92-b276-243495f81094',title:'HMS Game Center (W)',topic:'Přehled zápasů, Game Report, statistiky a časová osa.'},
 insights:{kind:'codex',id:'01a0b66d-b0eb-7fd1-a3af-274a23122bba',title:'HMS Insights (W)',topic:'Veřejné Insights, archiv, pravidla a výběr momentů.'},
 media:{kind:'chatgpt',id:'6ad7fd70-ff8c-83eb-a22a-d7c8f1230297',title:'HMS Media Studio (W)',topic:'Media Studio, grafiky, vzhled a nastavení organizací.'},
 legacy:{kind:'codex',id:'01a17804-89d3-7ca1-a7bf-8b74a78c3218',title:'Zobecnění starých apek',topic:'All Stars a postupná modernizace starších aplikací na HMS API.'},
 operations:{kind:'codex',id:'01a17539-342e-7841-ba13-1b36c14f880f',title:'Přidat provozní přehledy HMS',topic:'HMS Operations, směny, obsazení, platby a uzávěrky.'},
 map:{kind:'codex',id:'01a17063-9464-76f1-b3b6-5e4818bf05ad',title:'Rozcestník (W)',topic:'Mapa aplikací, odkazy, doména a orientace v ekosystému.'},
};
const assignments={
 broadcast:'broadcast','sponsors-catalog':'broadcast','sponsor-broadcast':'broadcast','sponsor-output':'broadcast',
 'games-view':'games','game-center':'games',
 'insights-definition':'insights','insights-public':'insights','insights-archive':'insights',
 studio:'media',operations:'operations',
 'all-stars':'legacy','awards-definition':'legacy','team-comparison':'legacy','player-comparison':'legacy',
 'playoff-players':'legacy','player-cards':'legacy','playoff-bracket':'legacy',betting:'legacy',
};
export function workChatHref(chat){
 if(!chat||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(chat.id))return null;
 if(chat.kind==='codex')return `codex://threads/${chat.id}`;
 if(chat.kind==='chatgpt')return `https://chatgpt.com/c/${chat.id}`;
 return null;
}
export function workChatFor(appId,nodeId){return workChats[assignments[nodeId]??assignments[appId]]??null;}
