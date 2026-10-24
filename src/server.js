import {createOrganizationImportHandler} from './web/organization-import-handler.js';
import {createSeasonGamesHandler} from './web/season-games-handler.js';
import {createBroadcastHandler} from './web/broadcast-handler.js';
import {createOrganizationImportPage} from './web/organization-import-page.js';
import {createPublicFeedHandler} from './web/public-feed-handler.js';
import {PHM_ORGANIZATION_ID} from './app/organizations.js';
import {createStudioImageHandler} from './web/studio-image-handler.js';
import {createStudioHandler} from './web/studio-handler.js';
import {createGameExtrasHandler} from './web/game-extras-handler.js';
import { createPlayerCardHandler } from "./web/player-card-handler.js";
import { playerCard } from "./app/player-card.js";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sampleAnalysis } from "./app/sample.js";
import { feedDemo } from "./app/feed-demo.js";
import { renderPriklepyPage } from "./web/render.js";
import { createGameReportHandler } from "./web/game-report-handler.js";
import { getGameSummary } from "./app/game-summary.js";
import { buildGameSummary } from "./domain/game-summary.js";
import { rowsFor } from "./infrastructure/analysis-rows.js";
import { analyzeHmsResponses } from "./app/analyze.js";
import { gameEvents as zbraslavEvents, lineup as zbraslavLineup } from "./fixtures/zbraslav-kosti.js";

const directory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(directory, "..", "public");
const port = Number(process.env.PORT ?? 3000);
const zbraslavAnalysis = analyzeHmsResponses(zbraslavEvents, zbraslavLineup);
const broadcastHandler=createBroadcastHandler();

const assets = {
  "/organization-import.js": ["text/javascript; charset=utf-8", "organization-import.js"],
  "/game-report-extras.js": ["text/javascript; charset=utf-8", "game-report-extras.js"],
  "/game-report-premium.css": ["text/css; charset=utf-8", "game-report-premium.css"],
  "/game-report-i18n.js": ["text/javascript; charset=utf-8", "game-report-i18n.js"],
  "/game-report-portraits.js": ["text/javascript; charset=utf-8", "game-report-portraits.js"],
  "/game-report-media.js": ["text/javascript; charset=utf-8", "game-report-media.js"],
  "/styles.css": ["text/css; charset=utf-8", "styles.css"],
  "/app.js": ["text/javascript; charset=utf-8", "app.js"],
  "/game-report-graphics.js": ["text/javascript; charset=utf-8", "game-report-graphics.js"],
  "/game-report.js": ["text/javascript; charset=utf-8", "game-report.js"],
  "/game-report-data.js": ["text/javascript; charset=utf-8", "game-report-data.js"],
  "/game-report.css": ["text/css; charset=utf-8", "game-report.css"],
  "/favicon.svg": ["image/svg+xml", "favicon.svg"],
};

export const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  if(url.pathname==='/api/games'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='games'){
    request.query=Object.fromEntries(url.searchParams);
    await createSeasonGamesHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(['/game-center','/game-center/','/games/index.html','/games/app.js','/games/styles.css'].includes(url.pathname)){
    const path=url.pathname.startsWith('/game-center')?'/games/index.html':url.pathname;
    response.setHeader('content-type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.end(await readFile(join(publicDirectory,path)));return;
  }
  if(url.pathname==='/api/broadcast'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='broadcast'){
    if(['POST','PATCH'].includes(request.method)){
      let body='';for await(const chunk of request){body+=chunk;if(body.length>4096){response.statusCode=413;response.end();return;}}request.body=body;
    }
    request.query=Object.fromEntries(url.searchParams);
    await broadcastHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(url.pathname==='/broadcast'||url.pathname==='/broadcast/'){
    response.writeHead(302,{location:'/broadcast/index.html'+url.search});response.end();return;
  }
  if(/^\/broadcast\/(index.html|app.js|hms-source.js|i18n.js|channel.js|match-layers.js|styles.css|fonts\/barlow-latin(?:-ext)?\.woff2)$/.test(url.pathname)){
    response.setHeader('content-type',url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':url.pathname.endsWith('.woff2')?'font/woff2':'text/javascript; charset=utf-8');
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');response.setHeader('cache-control','no-cache');
    response.end(await readFile(join(publicDirectory,url.pathname)));return;
  }
  if(['/admin/import-game','/admin/backfill','/api/admin/import-game','/api/admin/backfill'].includes(url.pathname)){
    request.query=Object.fromEntries(url.searchParams);
    const adapter={setHeader:(k,v)=>response.setHeader(k,v),status(code){response.statusCode=code;return this;},send(body){response.end(body);},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}};
    if(url.pathname.startsWith('/api/')){
      let body='';for await(const chunk of request){body+=chunk;if(body.length>8192){response.statusCode=413;response.end('Request too large');return;}}request.body=body;
      await createOrganizationImportHandler({batch:url.pathname.endsWith('/backfill')})(request,adapter);
    }else createOrganizationImportPage({batch:url.pathname.endsWith('/backfill')})(request,adapter);
    return;
  }
  if(url.pathname === "/api/player-card") {
    request.query={gameId:url.searchParams.get('gameId'),playerId:url.searchParams.get('playerId')};
    const loadCard=process.env.DATABASE_URL?undefined:async(gameId,playerId)=>{
      const a=[zbraslavAnalysis,sampleAnalysis].find(a=>a.game.gameId.toLowerCase()===gameId?.toLowerCase());
      if(!a)return null;
      const r=rowsFor(a),known=[...r.player_game_stats,...r.goalie_game_stats].some(p=>p.player_id.toLowerCase()===playerId?.toLowerCase());
      if(!known)return null;
      const keeper=r.goalie_game_stats.some(p=>p.player_id.toLowerCase()===playerId?.toLowerCase());
      const rows=(keeper?r.goalie_game_stats:r.player_game_stats).map(p=>({PlayerId:p.player_id,FirstName:p.player_name,GP:1,G:p.goals,A:p.assists,PIM:p.pim,Svs:p.saves,GA:p.goals_against}));
      return playerCard(rows,playerId,r.games[0],{role:keeper?'goalie':'skater',source:'imported-games'});
    };
    await createPlayerCardHandler({loadCard})(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}});return;
  }
  if(url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='extras'){
    request.query={gameId:url.searchParams.get('gameId')};
    await createGameExtrasHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}});return;
  }
  if(url.pathname==='/api/studio-image') {
    request.query=Object.fromEntries(url.searchParams);
    await createStudioImageHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},send(body){response.end(body);},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}});return;
  }
  if(url.pathname==='/api/studio') {
    request.query=Object.fromEntries(url.searchParams);
    await createStudioHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}});return;
  }
  if(/^\/studio\/fonts\/(fonts.css|files\/[a-z0-9-]+\.woff2)$/.test(url.pathname)) {
    response.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':'font/woff2');
    response.end(await readFile(join(publicDirectory,url.pathname)));return;
  }
  if(url.pathname==='/studio' || /^\/studio\/[a-zA-Z0-9-]+\/?$/.test(url.pathname) || /^\/studio\/(index.html|app.js|graphics.js|subjects.js|typography.js|i18n.js|routing.js|studio.css)$/.test(url.pathname)) {
    const name=!url.pathname.split('/').pop()?.includes('.')?'index.html':url.pathname.split('/').pop();
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript');
    response.end(await readFile(join(publicDirectory,'studio',name)));return;
  }
  const reportMatch = /^\/game-center\/([^/]+)(?:\/public)?$/.exec(url.pathname);
  if (reportMatch || url.pathname === "/api/game-summary") {
    request.query = { gameId: reportMatch?.[1] ?? url.searchParams.get("gameId"), lang: url.searchParams.get('lang') };
    const adapter = {
      setHeader: (key, value) => response.setHeader(key, value),
      status(code) { response.statusCode = code; return this; },
      send(body) { response.end(body); },
      json(body) { response.setHeader("content-type", "application/json; charset=utf-8"); response.end(JSON.stringify(body)); },
    };
    const loadSummary = process.env.DATABASE_URL ? getGameSummary : async (gameId) => {
      const preview = [zbraslavAnalysis, sampleAnalysis].find((item) => item.game.gameId.toLowerCase() === gameId.toLowerCase());
      if (!preview) return null;
      const rows = rowsFor(preview);
      return buildGameSummary({ game: rows.games[0], teams: rows.team_game_stats,
        players: rows.player_game_stats, goalies: rows.goalie_game_stats, priklepy: rows.detected_priklepy });
    };
    await createGameReportHandler({ json: !reportMatch, loadSummary, preview: !process.env.DATABASE_URL })(request, adapter);
    return;
  }
  if (url.pathname === "/") {
    response.writeHead(302, { location: "/priklepy" });
    response.end();
    return;
  }
  const feedPage=/^\/(priklepy|archiv)(?:\/([a-zA-Z0-9-]+))?\/?$/.exec(url.pathname);
  if(feedPage||['/api/feed','/api/selection'].includes(url.pathname)){
    request.query=Object.fromEntries(url.searchParams);
    const preview=process.env.DATABASE_URL?{}:{
      loadSelection:async({organizationId})=>({items:organizationId.toLowerCase()===PHM_ORGANIZATION_ID.toLowerCase()?feedDemo:[],hasMore:false,mode:'selection'}),
      loadPage:async({organizationId})=>({items:organizationId.toLowerCase()===PHM_ORGANIZATION_ID.toLowerCase()?feedDemo:[],hasMore:false,offset:0}),
      loadOptions:async()=>({}),
    };
    await createPublicFeedHandler({mode:feedPage?(feedPage[1]==='archiv'?'archive':'selection'):(url.pathname==='/api/feed'?'archive':'selection'),html:!!feedPage,...preview})(request,{
      setHeader:(k,v)=>response.setHeader(k,v),status(code){response.statusCode=code;return this;},send(body){response.end(body);},json(body){response.setHeader('Content-Type','application/json; charset=utf-8');response.end(JSON.stringify(body));},
    });return;
  }
  if (url.pathname === "/api/priklepy") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(sampleAnalysis));
    return;
  }
  if (assets[url.pathname]) {
    const [contentType, filename] = assets[url.pathname];
    response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    response.end(await readFile(join(publicDirectory, filename)));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Nenalezeno");
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`HMS Insights běží na http://localhost:${port}/priklepy`));
}
