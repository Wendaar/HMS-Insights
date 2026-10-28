// Public navigation metadata only. Never put credentials or private source exports here.
import {publicOutputUrl} from '../public-output.js';
export const repository = 'https://github.com/Wendaar/HMS-Insights';
const code = path => `${repository}/blob/main/${path}`;
export const categories = [
  {id:'media', name:'Content & Media', description:'Grafika, obsah a výstupy pro sociální sítě.'},
  {id:'stats', name:'Game & Stats', description:'Zápasy, výkony a porovnání.'},
  {id:'competition', name:'Competition', description:'Soutěže, historie a fanouškovské nástroje.'},
  {id:'website', name:'Website', description:'Webové komponenty a prezentace ligy.'},
  {id:'data', name:'Data & Admin', description:'Datové zdroje, importy a správa.'},
  {id:'development', name:'Development', description:'Kód, dokumentace a další rozvoj.'},
];
export const statuses = {
  available:'Dostupné', partial:'Částečně', missing:'Nenastaveno', prepared:'Připraveno',
};
export const linkLabels = {open:'Open', public:'Public', manage:'Manage', source:'Source', github:'GitHub'};
export const organizations = [
  {id:'phm', name:'PHM', ready:true, description:'Ověřené cesty v HMS Insights a známé externí aplikace.'},
  {id:'euchl', name:'EUCHL', ready:true, description:'HMS Studio a předzápasová grafika pro OBS napojená na HMS API.'},
  {id:'yhg', name:'YHG', ready:false, description:'Připraveno k doplnění vlastních aplikací a datových zdrojů.'},
  {id:'fllh', name:'FLLH', ready:false, description:'Připraveno k doplnění vlastních aplikací a datových zdrojů.'},
];
// Verified against the current repository routes / files. A route is not a live health check.
// Null links are intentional: do not infer an app URL or reuse PHM for another organization.
const missing = (id, category, name, description) => ({id,category,name,description,
  status:'missing', dataSource:'Nenastaveno', note:'Aplikace je v inventáři; její adresu a zdroj je potřeba ověřit.', links:{}});
const applications = [
  {id:'operations',category:'data',name:'HMS Operations',description:'Směny, kontrola obsazení, CASH, volný led a podklady měsíční uzávěrky.',status:'partial',dataSource:'Společné HMS API · provozní přístup organizace',note:'Pracovní verze. Živá data vyžadují samostatný provozní kód; mapování CASH / PAID a účetní sazby musí potvrdit organizace.',links:{open:'/operations?org=phm',manage:'/operations?org=phm',github:code('docs/OPERATIONS.md')}},
  {id:'broadcast',category:'media',name:'Opening Studio · OBS',description:'Předzápasová vrstva pro OBS a YouTube miniatura z HMS API.',status:'available',dataSource:'HMS API · zápas, týmy, loga a pořadatelé',note:'Čistý OBS výstup 1920 × 1080. Vyberte zápas v ovládání a zkopírujte jeho URL.',links:{open:'/broadcast/index.html?org=PHM',manage:'/broadcast/index.html?org=PHM',source:'/api/broadcast?org=PHM',github:'https://github.com/Wendaar/Youtube-Overlays'}},
  {id:'studio',category:'media',name:'Media Studio',description:'Grafika zápasů a Insights, náhledy a export PNG.',status:'available',dataSource:'HMS API / uložené snapshoty zápasů',note:'Dostupnost živých dat závisí na připojení organizace.',links:{open:'/studio/phm?lang=cs',manage:'/studio/phm?lang=cs',github:code('public/studio/app.js')}},
  {id:'all-stars',category:'media',name:'All Stars of Month',description:'Měsíční nominace z HMS, ruční sestava 3+2+1 a publikovaný výstup.',status:'partial',dataSource:'HMS API / společné snapshoty dokončených zápasů',note:'Beta. Kontrola úplnosti měsíce; předběžné pořadí bez nedostupných hvězd a shutoutů. Původní generátor zůstává dostupný ze správy.',links:{open:'/control/apps/all-stars?org=phm',manage:'/control/apps/all-stars?org=phm',public:'/all-stars/phm',source:'/api/all-stars?action=catalog&org=phm',github:code('docs/ALL-STARS.md')}},
  {id:'player-cards',category:'media',name:'Player Cards · kartičky hráčů',description:'Datová kartička hráče z importovaného zápasu.',status:'partial',dataSource:'Importované statistiky zápasů / HMS',note:'Ověřený je datový endpoint /api/player-card (gameId + playerId). Samostatný generátor zatím nemá ověřenou adresu.',links:{github:code('src/web/player-card-handler.js')}},
  missing('medals','media','Medailové infografiky','Grafiky pro medailové a finálové zápasy.'),
  {id:'insights-public',category:'stats',name:'Insights · Public',description:'Veřejný výběr nejzajímavějších výkonů a Příklepů.',status:'available',dataSource:'Uložené Příklepy z dokončených zápasů',note:'Výběr PHM; API vrací data pouze této organizace.',links:{open:'/priklepy/phm',public:'/priklepy/phm',source:'/api/selection?org=PHM',github:code('src/web/public-feed-handler.js')}},
  {id:'insights-archive',category:'stats',name:'Insights · Archive',description:'Úplná historie Příklepů s hledáním a filtry.',status:'available',dataSource:'Databáze importovaných Příklepů',links:{open:'/archiv/phm',public:'/archiv/phm',source:'/api/feed?org=PHM',github:code('src/web/feed-loader.js')}},
  {id:'insights-definition',category:'stats',name:'Insights · Definition',description:'Pravidla, podle kterých vznikají Příklepy.',status:'partial',dataSource:'Pravidla v kódu HMS Insights',note:'Definice se mění v kódu. Samostatný editor není nastaven.',links:{manage:code('src/domain/rules.js'),github:code('src/domain/rules.js')}},
  {id:'game-center',category:'stats',name:'Game Center · Game Report',description:'Report zápasu, sestavy, statistiky a časová osa.',status:'available',dataSource:'Importovaný GameSummary / snapshot HMS',note:'Vyberte zápas podle týmů a data nad mapou. Report zobrazuje již načtený zápas.',gamePath:'/game-center/',links:{github:code('src/web/game-report-handler.js')}},
  {id:'team-comparison',category:'stats',name:'Porovnání týmů',description:'Dva týmy ze stejné divize a fáze: tabulka, forma, hráči a brankáři.',status:'partial',dataSource:'HMS API / společné importované výsledky',note:'Beta. Výběr sezony a fáze, CS/EN, sdílení, vložení na web a PNG. Forma jen při ověřené úplnosti. Hranice startů je volitelná.',links:{open:'/control/apps/team-comparison?org=phm',manage:'/control/apps/team-comparison?org=phm',public:'/team-comparison/phm',github:code('docs/TEAM-COMPARISON.md')}},
  missing('player-comparison','stats','Porovnání hráčů','Srovnání hráčů včetně výběru pro playoff.'),
  {id:'playoff-players',category:'competition',name:'Hráči do playoff',description:'Kontrola počtu startů s nastavením sezony, limitu a zdroje dat.',status:'available',dataSource:'Google Sheet · Players_Stats',note:'Samostatná aplikace s pracovní verzí, náhledem a publikací. Splnění počtu startů není úplné posouzení způsobilosti.',links:{open:'/control/apps/playoff-players?org=phm',public:'/tools/playoff-players/phm/phm-cup-2026',manage:'/control/apps/playoff-players?org=phm',source:'https://docs.google.com/spreadsheets/d/1MlsEBrd72RjeKS8vrnapjtu0KfIUaLciIYrEG_uc-rM/edit#gid=1700599931',github:code('src/app/playoff-players.js')}},
  missing('hall-of-fame','competition','Hall of Fame','Vítězové, osobnosti a historie soutěže.'),
  missing('playoff-bracket','competition','Playoff pavouk','Přehled sérií a cesty k finále.'),
  missing('betting','competition','Sázkovka','Fanouškovské tipování výsledků.'),
  missing('calendar','competition','Calendar · kalendář','Kalendář a rozpis soutěže.'),
  missing('public-website','website','Veřejný web organizace','Hlavní web a jeho redakční správa.'),
  missing('team-carousel','website','Team Carousel','Přehled týmů pro vložení na web.'),
  missing('phm-tv','website','PHM TV','Videa, přenosy a televizní obsah.'),
  missing('banners','website','Bannery','Webové bannery a reklamní plochy.'),
  {id:'import-game',category:'data',name:'Import zápasu',description:'Načtení jednoho dokončeného zápasu a přepočet Příklepů.',status:'available',dataSource:'HMS API → databáze',note:'Spuštění importu vyžaduje existující administrátorský secret.',links:{manage:'/admin/import-game?org=PHM',github:code('src/web/organization-import-handler.js')}},
  {id:'backfill',category:'data',name:'Historický import',description:'Postupný import dokončených zápasů za zvolené období.',status:'available',dataSource:'HMS API → databáze',note:'Spuštění importu vyžaduje existující administrátorský secret.',links:{manage:'/admin/backfill?org=PHM',github:code('src/app/backfill-finished-games.js')}},
  {id:'connections',category:'data',name:'Datová připojení',description:'Nastavení organizací, HMS API a webhooků.',status:'partial',dataSource:'Serverová konfigurace; hodnoty se zde nezobrazují',note:'Návod je ověřený. Přímá adresa správy připojení není nastavena.',links:{github:code('docs/STUDIO-ORGANIZATIONS.md')}},
  {id:'repository',category:'development',name:'HMS Insights · repozitář',description:'Zdrojový kód, změny a požadavky na rozvoj.',status:'available',dataSource:'GitHub',links:{open:repository,manage:`${repository}/issues`,github:repository}},
  {id:'documentation',category:'development',name:'Dokumentace',description:'Zapojení Studia, Game Center a organizačních zdrojů.',status:'available',dataSource:'Dokumentace v repozitáři',links:{open:code('docs/MEDIA-STUDIO.md'),github:`${repository}/tree/main/docs`}},
];
applications.push(
  {id:'sponsors-catalog',category:'data',name:'Sponzoři z HMS · náhled API',description:'Čtecí katalog sponzorů a jejich vazeb z nové HMS API vrstvy. Otevírá samostatný existující náhled.',status:'partial',dataSource:'HMS API · sponzoři a vazby',note:'Beta v samostatném náhledu. Sjednocení Media Studia a dalších nástrojů nad touto vrstvou je plánované.',links:{open:'https://hms-insights-git-codex-broadcast-expansion-preview-wendaar.vercel.app/broadcast/sponsors.html?org=PHM'}},
  {id:'games-view',category:'stats',name:'Games View',description:'Přehled zápasů vybrané ligy a sezony.',status:'available',dataSource:'HMS API · sezona podle názvu',links:{open:'/game-center',github:code('public/games/app.js')}},
  {id:'data-engine',category:'data',name:'Data Engine',description:'Společná datová vrstva HMS. Odkaz otevře kód.',status:'available',dataSource:'HMS → importy a snapshoty',links:{github:`${repository}/tree/main/src/app`}},
  {id:'database',category:'data',name:'DB · PostgreSQL',description:'Schéma databáze v kódu; přístup do konzole není nakonfigurovaný.',status:'partial',dataSource:'PostgreSQL',links:{github:`${repository}/tree/main/db`}},
  {id:'deploy',category:'development',name:'Deploy · Vercel',description:'Návod k nasazení; neveřejná konzole není nastavená.',status:'partial',dataSource:'Vercel',links:{open:code('VERCEL_SETUP.md'),github:code('vercel.json')}},
  {id:'security',category:'development',name:'Security',description:'Organizační připojení, serverové tokeny a webhooky. Odkaz otevře dokumentaci.',status:'partial',dataSource:'Serverová konfigurace',links:{github:code('docs/STUDIO-ORGANIZATIONS.md')}}
);
export function organizationById(id) {
  return organizations.find(org => org.id === String(id).toLowerCase()) ?? null;
}
export function appsForOrganization(id) {
  const org = organizationById(id);
  if (!org) return [];
  if (org.id === 'phm') return applications.map(publicLinks);
  if (org.id === 'euchl') return applications.map(app=>{
    if(app.id==='team-comparison')return {...app,links:{...app.links,open:'/control/apps/team-comparison?org=euchl',manage:'/control/apps/team-comparison?org=euchl',public:'/team-comparison/euchl'}};
    if(app.id==='all-stars')return {...app,links:{...app.links,open:'/control/apps/all-stars?org=euchl',manage:'/control/apps/all-stars?org=euchl',public:'/all-stars/euchl',source:'/api/all-stars?action=catalog&org=euchl'}};
    if(app.id==='operations')return {...app,links:{...app.links,open:'/operations?org=euchl',manage:'/operations?org=euchl'}};
    if(['games-view','game-center','data-engine','database','security'].includes(app.id))return app;
    if(app.id==='sponsors-catalog')return {...app,links:{open:'https://hms-insights-git-codex-broadcast-expansion-preview-wendaar.vercel.app/broadcast/sponsors.html?org=EUCHL'}};
    if(app.id==='broadcast')return {...app,links:{...app.links,open:'/broadcast/index.html?org=EUCHL',manage:'/broadcast/index.html?org=EUCHL',source:'/api/broadcast?org=EUCHL'}};
    if(app.id==='studio')return {...app,links:{...app.links,open:'/studio/euchl?lang=cs',manage:'/studio/euchl?lang=cs'}};
    if(app.id==='insights-public')return {...app,note:'Výběr EUCHL z importovaných zápasů.',links:{...app.links,open:'/priklepy/euchl',public:'/priklepy/euchl',source:'/api/selection?org=EUCHL'}};
    if(app.id==='insights-archive')return {...app,links:{...app.links,open:'/archiv/euchl',public:'/archiv/euchl',source:'/api/feed?org=EUCHL'}};
    if(app.category==='development')return app;
    return {...app,status:'prepared',dataSource:'Nenastaveno',gamePath:undefined,links:{},note:'Pro EUCHL zatím není tento nástroj nastavený.'};
  }).map(publicLinks);
  return applications.map(app => ({id:app.id,category:app.category,name:app.id==='phm-tv'?`${org.name} TV`:app.name,
    description:app.description,status:'prepared',dataSource:'Nenastaveno',links:{},
    note:`Pro ${org.name} zatím nejsou ověřené odkazy ani datové připojení.`}));
}
export function gameReportUrl(orgId, value) {
  const path = appsForOrganization(orgId).find(app => app.id === 'game-center')?.gamePath;
  const id = String(value ?? '').trim();
  if (!path || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return publicOutputUrl(path + encodeURIComponent(id));
}
function publicLinks(app){
 return {...app,links:Object.fromEntries(Object.entries(app.links).map(([kind,href])=>[kind,
  href.startsWith('/')&&(kind==='public'||kind==='open'&&['insights-public','insights-archive'].includes(app.id))?publicOutputUrl(href):href]))};
}
const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterApps(apps, {query='', category='all', status='all'}={}) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return apps.filter(app => (category==='all'||app.category===category) && (status==='all'||app.status===status)
    && words.every(word => fold([app.name,app.description,app.dataSource,app.note,categories.find(c=>c.id===app.category)?.name].join(' ')).includes(word)));
}
