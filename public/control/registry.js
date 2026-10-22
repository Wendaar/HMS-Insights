// Public navigation metadata only. Never put credentials or private source exports here.
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
  {id:'yhg', name:'YHG', ready:false, description:'Připraveno k doplnění vlastních aplikací a datových zdrojů.'},
  {id:'fllh', name:'FLLH', ready:false, description:'Připraveno k doplnění vlastních aplikací a datových zdrojů.'},
];
// Verified against the current repository routes / files. A route is not a live health check.
// Null links are intentional: do not infer an app URL or reuse PHM for another organization.
const missing = (id, category, name, description) => ({id,category,name,description,
  status:'missing', dataSource:'Nenastaveno', note:'Aplikace je v inventáři; její adresu a zdroj je potřeba ověřit.', links:{}});
const applications = [
  {id:'studio',category:'media',name:'Media Studio',description:'Grafika zápasů a Insights, náhledy a export PNG.',status:'available',dataSource:'HMS API / uložené snapshoty zápasů',note:'Dostupnost živých dat závisí na připojení organizace.',links:{open:'/studio/phm?lang=cs',manage:'/studio/phm?lang=cs',github:code('public/studio/app.js')}},
  {id:'all-stars',category:'media',name:'All Stars Generator',description:'Měsíční výběr hráčů, nominace a grafika All Stars.',status:'partial',dataSource:'Google Sheet → XLSX / přibalený snímek k 2. 10. 2026',note:'Samostatná aplikace. Průběžné HMS API zatím není připojeno; adresa Sheetu není ověřena.',links:{open:'https://wendaar.github.io/PHM-All-Stars-generator/',public:'https://wendaar.github.io/PHM-All-Stars-generator/',github:'https://github.com/Wendaar/PHM-All-Stars-generator'}},
  {id:'player-cards',category:'media',name:'Player Cards · kartičky hráčů',description:'Datová kartička hráče z importovaného zápasu.',status:'partial',dataSource:'Importované statistiky zápasů / HMS',note:'Ověřený je datový endpoint /api/player-card (gameId + playerId). Samostatný generátor zatím nemá ověřenou adresu.',links:{github:code('src/web/player-card-handler.js')}},
  missing('medals','media','Medailové infografiky','Grafiky pro medailové a finálové zápasy.'),
  {id:'insights-public',category:'stats',name:'Insights · Public',description:'Veřejný výběr nejzajímavějších výkonů a Příklepů.',status:'available',dataSource:'Uložené Příklepy z dokončených zápasů',note:'Výběr PHM; API vrací data pouze této organizace.',links:{open:'/priklepy/phm',public:'/priklepy/phm',source:'/api/selection?org=PHM',github:code('src/web/public-feed-handler.js')}},
  {id:'insights-archive',category:'stats',name:'Insights · Archive',description:'Úplná historie Příklepů s hledáním a filtry.',status:'available',dataSource:'Databáze importovaných Příklepů',links:{open:'/archiv/phm',public:'/archiv/phm',source:'/api/feed?org=PHM',github:code('src/web/feed-loader.js')}},
  {id:'insights-definition',category:'stats',name:'Insights · Definition',description:'Pravidla, podle kterých vznikají Příklepy.',status:'partial',dataSource:'Pravidla v kódu HMS Insights',note:'Definice se mění v kódu. Samostatný editor není nastaven.',links:{manage:code('src/domain/rules.js'),github:code('src/domain/rules.js')}},
  {id:'game-center',category:'stats',name:'Game Center · Game Report',description:'Report zápasu, sestavy, statistiky a časová osa.',status:'available',dataSource:'Importovaný GameSummary / snapshot HMS',note:'Níže vložte Game ID. Report vyžaduje importovaný zápas; nenahrává nová data.',gamePath:'/game-center/',links:{github:code('src/web/game-report-handler.js')}},
  missing('team-comparison','stats','Porovnání týmů','Srovnání statistik a výkonů týmů.'),
  missing('player-comparison','stats','Porovnání hráčů','Srovnání hráčů včetně výběru pro playoff.'),
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
export function organizationById(id) {
  return organizations.find(org => org.id === String(id).toLowerCase()) ?? null;
}
export function appsForOrganization(id) {
  const org = organizationById(id);
  if (!org) return [];
  if (org.id === 'phm') return applications;
  return applications.map(app => ({id:app.id,category:app.category,name:app.id==='phm-tv'?`${org.name} TV`:app.name,
    description:app.description,status:'prepared',dataSource:'Nenastaveno',links:{},
    note:`Pro ${org.name} zatím nejsou ověřené odkazy ani datové připojení.`}));
}
export function gameReportUrl(orgId, value) {
  const path = appsForOrganization(orgId).find(app => app.id === 'game-center')?.gamePath;
  const id = String(value ?? '').trim();
  if (!path || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return path + encodeURIComponent(id);
}
const fold = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterApps(apps, {query='', category='all', status='all'}={}) {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return apps.filter(app => (category==='all'||app.category===category) && (status==='all'||app.status===status)
    && words.every(word => fold([app.name,app.description,app.dataSource,app.note,categories.find(c=>c.id===app.category)?.name].join(' ')).includes(word)));
}
