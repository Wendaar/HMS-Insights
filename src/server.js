import {createMatchPreviewHandler} from './web/match-preview-handler.js';
const matchPreviewHandler=createMatchPreviewHandler();
import {createGameDayHandler} from './web/game-day-handler.js';
const gameDayHandler=createGameDayHandler();
import {createSponsorsHandler} from './web/sponsors-handler.js';
import {createMediaMappingHandler} from './web/media-mapping-handler.js';
import {createRegistrationControlHandler} from './web/registration-control-handler.js';
import {createPublicPortalHandler} from './web/public-portal-handler.js';
import {createTeamComparisonHandler} from './web/team-comparison-handler.js';
import {createOperationsHandler} from './web/operations-handler.js';
import {createAllStarsHandler} from './web/all-stars-handler.js';
import {createOrganizationImportHandler} from './web/organization-import-handler.js';
import {createSeasonGamesHandler} from './web/season-games-handler.js';
import {createToolsHandler} from './web/tools-handler.js';
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
const registrationsHandler = createRegistrationControlHandler();
const port = Number(process.env.PORT ?? 3000);
const zbraslavAnalysis = analyzeHmsResponses(zbraslavEvents, zbraslavLineup);
const toolsHandler = createToolsHandler();
const broadcastHandler = createBroadcastHandler();
const portalHandler = createPublicPortalHandler();

const assets = {
  '/venue-media.js':['text/javascript; charset=utf-8','venue-media.js'],
  '/match-preview.css':['text/css; charset=utf-8','match-preview.css'],
  '/organization-catalog.js':['text/javascript; charset=utf-8','organization-catalog.js'],
  '/hms-favicon-public-v2.svg':['image/svg+xml','hms-favicon-public-v2.svg'],
  '/hms-favicon-control-v2.svg':['image/svg+xml','hms-favicon-control-v2.svg'],
  '/hms-favicon-public-v2.png':['image/png','hms-favicon-public-v2.png'],
  '/hms-favicon-control-v2.png':['image/png','hms-favicon-control-v2.png'],
  '/public-output.js':['text/javascript; charset=utf-8','public-output.js'],
  '/insights-i18n.js':['text/javascript; charset=utf-8','insights-i18n.js'],
  '/hms-brand.css':['text/css; charset=utf-8','hms-brand.css'],
  '/hms-brand.js':['text/javascript; charset=utf-8','hms-brand.js'],
  '/hms-logo.png':['image/png','hms-logo.png'],
  '/hms-favicon-32.png':['image/png','hms-favicon-32.png'],
  "/organization-import.js": ["text/javascript; charset=utf-8", "organization-import.js"],
  "/game-report-extras.js": ["text/javascript; charset=utf-8", "game-report-extras.js"],
  "/game-report-premium.css": ["text/css; charset=utf-8", "game-report-premium.css"],
  "/game-report-i18n.js": ["text/javascript; charset=utf-8", "game-report-i18n.js"],
  "/game-report-portraits.js": ["text/javascript; charset=utf-8", "game-report-portraits.js"],
  "/game-report-media.js": ["text/javascript; charset=utf-8", "game-report-media.js"],
  "/insights-carousel.js": ["text/javascript; charset=utf-8", "insights-carousel.js"],
  "/insights-carousel.css": ["text/css; charset=utf-8", "insights-carousel.css"],
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
  const pregameMatch=/^\/m\/([a-z0-9-]+)\/([a-fA-F0-9-]+)(?:\/(analysis))?\/?$/.exec(url.pathname);
  if(pregameMatch||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='match-preview'){
    request.query={...Object.fromEntries(url.searchParams),...(pregameMatch?{org:pregameMatch[1],gameId:pregameMatch[2],action:pregameMatch[3]}:{})};
    await matchPreviewHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(code){response.statusCode=code;return this;},send(body){response.end(body);}});return;
  }
  if(url.pathname==='/api/game-day'||url.pathname==='/api/cron/reminders'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='game-day'){
    request.query=Object.fromEntries(url.searchParams);if(url.pathname==='/api/cron/reminders')request.query.action='cron';
    if(request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>250000){response.writeHead(413);response.end();return;}}request.body=body;}
    await gameDayHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(url.pathname==='/api/registrations'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='registrations'){
    request.query=Object.fromEntries(url.searchParams);
    if(request.method==='POST'){let size=0,body='';for await(const chunk of request){size+=chunk.length;if(size>4000000){response.writeHead(413);response.end();return;}body+=chunk;}request.body=body;}
    await registrationsHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  const registrationAsset=/^\/registrations\/(app.js|app.css|index.html)$/.exec(url.pathname);
  if(registrationAsset||['/registrations/team','/registrations/admin','/control/apps/registrations'].includes(url.pathname)){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=registrationAsset?.[1]??'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.setHeader('cache-control','private, no-store');response.setHeader('x-robots-tag','noindex, nofollow, noarchive');
    response.setHeader('referrer-policy','no-referrer');response.setHeader('x-content-type-options','nosniff');
    response.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https://prod-hms-wootera.s3.eu-central-1.amazonaws.com https://hockeymanagementsystem.s3.amazonaws.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'registrations',name)));return;
  }
  if(url.pathname==='/api/portal'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='portal'){
    request.query=Object.fromEntries(url.searchParams);
    if(request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>50000){response.writeHead(413);response.end();return;}}request.body=body;}
    await portalHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));},send(body){response.end(body);}});return;
  }
  const portalAsset=/^\/league\/(app.js|app.css|presentation.js|index.html)$/.exec(url.pathname);
  if(portalAsset||/^\/league\/[a-z0-9-]+\/?$/.test(url.pathname)||url.pathname==='/control/apps/public-portal'||url.pathname==='/'&&url.hostname==='public.heromanagementsystem.com'){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=portalAsset?.[1]??'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' https:; frame-src 'self' https://prod.hms.wootera.net; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');response.setHeader('cache-control','no-store');
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'league',name)));return;
  }
  if(url.pathname==='/api/team-comparison'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='team-comparison'){
    request.query=Object.fromEntries(url.searchParams);
    await createTeamComparisonHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  const comparisonAsset=/^\/team-comparison\/(app.js|app.css|graphics.js|analytics-view.js|ui.js|index.html)$/.exec(url.pathname);
  if(comparisonAsset||/^\/team-comparison\/[a-z0-9-]+\/?$/.test(url.pathname)||url.pathname==='/control/apps/team-comparison'){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=comparisonAsset?.[1]??'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');
    response.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' blob: https://prod-hms-wootera.s3.eu-central-1.amazonaws.com https://hockeymanagementsystem.s3.amazonaws.com; base-uri 'none'; form-action 'self'; frame-ancestors "+(url.pathname.startsWith('/control')?"'none'":'*'));
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'team-comparison',name)));return;
  }
  if(url.pathname==='/api/media-mapping'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='media-mapping'){
    request.query=Object.fromEntries(url.searchParams);
    if(request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>100000){response.writeHead(413);response.end();return;}}request.body=body;}
    await createMediaMappingHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(['/media-mapping','/media-mapping/','/studio/media-mapping','/studio/media-mapping/'].includes(url.pathname)||/^\/media-mapping\/(index.html|app.js|model.js|style.css)$/.test(url.pathname)){
    const name=/\.(html|js|css)$/.test(url.pathname)?url.pathname.split('/').pop():'index.html';response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript');response.setHeader('x-robots-tag','noindex, nofollow');response.end(await readFile(join(publicDirectory,'media-mapping',name)));return;
  }
  if(url.pathname.startsWith('/media/audio/')){
    const {mediaPath}=await import('../public/media-mapping/model.js');const valid=mediaPath(url.pathname);if(!valid){response.writeHead(400);response.end();return;}
    const target=join(publicDirectory,decodeURIComponent(valid));try{const bytes=await readFile(target);const ext=valid.split('.').pop().toLowerCase();response.setHeader('content-type',({mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',webm:'audio/webm'})[ext]);response.setHeader('content-length',bytes.length);response.setHeader('x-content-type-options','nosniff');response.end(request.method==='HEAD'?undefined:bytes);}catch{response.writeHead(404);response.end();}return;
  }
  if(url.pathname==='/api/all-stars'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='all-stars'){
    request.query=Object.fromEntries(url.searchParams);
    if(request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>20000){response.writeHead(413);response.end();return;}}request.body=body;}
    await createAllStarsHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  const allStarsAsset=/^\/all-stars\/(app.js|app.css|index.html|graphics.js|presentation.js|assets\/(?:landscape|portrait)\.webp)$/.exec(url.pathname);
  if(allStarsAsset||/^\/all-stars\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/.test(url.pathname)||url.pathname==='/control/apps/all-stars'){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=allStarsAsset?.[1]??'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.webp')?'image/webp':'text/javascript; charset=utf-8');
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');
    response.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors "+(url.pathname.startsWith('/control')?"'none'":'*'));
    if(url.pathname.startsWith('/control'))response.setHeader('x-robots-tag','noindex, nofollow');
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'all-stars',name)));return;
  }
  if(url.pathname==='/api/operations'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='operations'){
    request.query=Object.fromEntries(url.searchParams);
    await createOperationsHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(['/operations','/operations/','/operations/index.html','/operations/app.js','/operations/loading.js','/operations/snapshot.js','/operations/model.js','/operations/demo.js','/operations/styles.css'].includes(url.pathname)){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=['/operations','/operations/'].includes(url.pathname)?'index.html':url.pathname.split('/').pop();
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.setHeader('cache-control','no-store');response.setHeader('x-robots-tag','noindex, nofollow');response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');
    response.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'operations',name)));return;
  }
  if(url.pathname==='/api/games'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='games'){
    request.query=Object.fromEntries(url.searchParams);
    await createSeasonGamesHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(['/game-center','/game-center/','/games/index.html','/games/app.js','/games/navigation.js','/games/styles.css'].includes(url.pathname)||/^\/games\/[a-z0-9-]+\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/.test(url.pathname)){
    const path=url.pathname.startsWith('/game-center')||/^\/games\/[a-z0-9-]+\//.test(url.pathname)?'/games/index.html':url.pathname;
    response.setHeader('content-type',path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.end(await readFile(join(publicDirectory,path)));return;
  }
  if(url.pathname==='/sponsors/logos/restaurace-cerny-orel.png'){response.setHeader('content-type','image/png');response.end(await readFile(join(publicDirectory,'sponsors/logos/restaurace-cerny-orel.png')));return;}
  if(url.pathname==='/api/sponsors'){request.query=Object.fromEntries(url.searchParams);await createSponsorsHandler()(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json');response.end(JSON.stringify(body));}});return;}
  if(/^\/sponsors\/(model|picker|rotation)\.js$/.test(url.pathname)){response.setHeader('content-type','text/javascript');response.end(await readFile(join(publicDirectory,url.pathname)));return;}
  if(url.pathname==='/api/broadcast'||url.pathname==='/api/game-summary'&&url.searchParams.get('view')==='broadcast'){
    if(['POST','PATCH'].includes(request.method)){
      let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>(url.searchParams.get('library')==='1'?1800100:4096)){response.statusCode=413;response.end();return;}}request.body=body;
    }
    request.query=Object.fromEntries(url.searchParams);
    await broadcastHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  if(['/broadcast/sponsors.html','/sponsors/'].includes(url.pathname)){response.writeHead(302,{location:'/sponsors'+url.search});response.end();return;}
  if(url.pathname==='/sponsors'){response.setHeader('content-type','text/html; charset=utf-8');response.setHeader('x-robots-tag','noindex, nofollow');response.setHeader('cache-control','no-cache');response.end(await readFile(join(publicDirectory,'broadcast/sponsors.html')));return;}
  if(url.pathname==='/broadcast'||url.pathname==='/broadcast/'){
    response.writeHead(302,{location:'/broadcast/index.html'+url.search});response.end();return;
  }
  if(/^\/broadcast\/(index.html|demo.html|demo.js|sponsors.html|sponsors.js|partner-playlist.js|identity.js|library.js|app.js|hms-source.js|i18n.js|channel.js|match-layers.js|league-layers.js|extra-layers.js|styles.css|fonts\/barlow-latin(?:-ext)?\.woff2)$/.test(url.pathname)){
    response.setHeader('content-type',url.pathname.endsWith('.html')?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css; charset=utf-8':url.pathname.endsWith('.woff2')?'font/woff2':'text/javascript; charset=utf-8');
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');response.setHeader('cache-control','no-cache');
    response.end(await readFile(join(publicDirectory,url.pathname)));return;
  }
  if (url.pathname === '/api/tools' || url.pathname === '/api/game-summary' && url.searchParams.get('view') === 'tools') {
    request.query=Object.fromEntries(url.searchParams);
    if(request.method==='POST'){
      let body='';for await(const chunk of request){body+=chunk;if(Buffer.byteLength(body)>20000){response.writeHead(413,{'content-type':'application/json'});response.end(JSON.stringify({error:'Nastavení je příliš velké.'}));return;}}request.body=body;
    }
    await toolsHandler(request,{setHeader:(k,v)=>response.setHeader(k,v),status(c){response.statusCode=c;return this;},json(body){response.setHeader('content-type','application/json; charset=utf-8');response.end(JSON.stringify(body));}});return;
  }
  const toolAsset=/^\/tools\/playoff-players\/(app.js|app.css|index.html)$/.exec(url.pathname);
  const toolPage=url.pathname==='/tools/playoff-players'||/^\/tools\/playoff-players\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(url.pathname);
  const toolManage=url.pathname==='/control/apps/playoff-players';
  if(toolAsset||toolPage||toolManage){
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{allow:'GET, HEAD'});response.end();return;}
    const name=toolAsset?.[1]??'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    response.setHeader('x-content-type-options','nosniff');response.setHeader('referrer-policy','no-referrer');response.setHeader('cache-control','no-cache');
    response.setHeader('content-security-policy',`default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' https:; base-uri 'none'; form-action 'self'; frame-ancestors ${toolManage?"'none'":'*'}`);
    if(toolManage)response.setHeader('x-robots-tag','noindex, nofollow');
    response.end(request.method==='HEAD'?undefined:await readFile(join(publicDirectory,'tools','playoff-players',name)));return;
  }
  if (['/control', '/control/', '/control/index.html', '/control/app.js', '/control/registry.js', '/control/map.js', '/control/work-chats.js', '/control/control.css'].includes(url.pathname)) {
    response.setHeader('x-robots-tag', 'noindex, nofollow');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {allow:'GET, HEAD'});response.end('Method not allowed');return;
    }
    const name = ['/control', '/control/'].includes(url.pathname) ? 'index.html' : url.pathname.split('/').pop();
    response.setHeader('content-type', name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    response.setHeader('cache-control', 'no-cache');
    response.end(request.method === 'HEAD' ? undefined : await readFile(join(publicDirectory, 'control', name)));return;
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
  if(['/studio/announcer','/studio/announcer/','/show-control','/show-control/'].includes(url.pathname)||/^\/show-control\/(index.html|app.js|model.js|audio.js|speech.js|style.css)$/.test(url.pathname)){
    const name=/\.(html|js|css)$/.test(url.pathname)?url.pathname.split('/').pop():'index.html';
    response.setHeader('content-type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css':'text/javascript');
    response.setHeader('cache-control','no-cache');response.setHeader('x-robots-tag','noindex, nofollow');
    response.end(await readFile(join(publicDirectory,'show-control',name)));return;
  }
  if(url.pathname==='/studio' || /^\/studio\/[a-zA-Z0-9-]+\/?$/.test(url.pathname) || /^\/studio\/(index.html|app.js|graphics.js|subjects.js|typography.js|preferences.js|game-day.js|game-day-data.js|game-day-invitation.js|game-day-graphics.js|team-compare.js|i18n.js|routing.js|studio.css)$/.test(url.pathname)) {
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
