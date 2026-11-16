# HMS — Vercel Architecture Optimization, Phase 2

17. 11. 2026. **Pouze audit, rozhodnutí a plán. Žádná produkční migrace.** Tento dokument nahrazuje doporučení původního auditu v PR #75.

## Rozhodnutí a rozsah důkazů

Doporučuji **7 Vercel Projects v jednom monorepu a jednom týmu**: Gateway/Control, Core, Public, Studio, Broadcast, Show a Camera. Počet zahrnuje stabilní vstupní vrstvu pro původní URL. Photo Archive zatím patří do Studia, s vlastním rozpočtem a omezením AI práce. Osmý projekt pro něj nemá nyní doložený přínos. Core obsahuje i soukromou administrativu; případné další dělení je budoucí rozhodnutí.

Audit používá úplný klon větve PR #75, commit `43142e6a1bd53e2dd762860400feaf072f76897b`. Načtený současný `main` je `8ca4fe74b2bc948bd38e976b111c89093fdeae5d`; rozdíl je pouze původní auditní dokument. Zjištění tedy platí pro tento main; shoda s aktuálním produkčním deploymentem není nezávisle ověřena.

Výchozí strom má **548 tracked souborů, 438 textových, 12 API entrypointů, 64 rewrites, 11 redirects a 19 skupin headers**. Počty jsou před přidáním Phase 2 dokumentace a generátoru. [Úplný strojový soupis](architecture-evidence/inventory.json) obsahuje každý soubor, importy, plnou routing konfiguraci v původním pořadí, externí hosty, časovače, SQL a názvy env s cestou/řádkem. Generátor `node scripts/audit-architecture.mjs` nečte hodnoty secrets ani nepoužívá síť/DB. Jde o úplnou inventuru a statické reference, nikoli tvrzení, že každý řádek prošel bezpečnostním auditem; dynamicky skládané URL/SQL/env vyžadují ruční kontrolu.

Ruční kontrola pokrývá kritické routery, Camera, Broadcast, Show, Games polling, organizační resolver, úložiště a feature entrypointy. Projektový index a dokumentace `docs/` byly porovnány s existujícími soubory a routami; staré popisy preview/PR nejsou důkazem dnešního nasazení. `docs/` obsahuje také statický web, nikoli pouze dokumentaci.

**Nemáme Vercel Usage po URL, produkční logy, dashboard domén/projektů, Neon query statistiky ani reálný OBS test.** Informace o překročení Hobby a aktivním Pro je od zadavatele. Staré agregované hodnoty v původním auditu nemají přiložený ověřitelný export; neatribuuji podle nich spotřebu aplikacím. Nečetl jsem hodnoty secrets, neměnil DB/domény/Vercel settings ani neaktivoval placenou službu.

## Aplikace a cílové vlastnictví

„Implementováno“ znamená existující kód/routu, nikoli úspěšný live test každé organizace. Štítek Ready/Beta v mapě není health check.

| Aplikace / součást | Stav a hlavní kód | Zachovat rozhraní | Cíl |
|---|---|---|---|
| Control Center, mapa a pracovní odkazy | `public/control/{app,map,registry,work-chats}.js`, katalog org | `/control[/]`, assets, launcher `app.phmcup.cz/control` | Gateway/Control |
| Insights/Příklepy a archiv | `public/app.js`, carousel, public-feed handler, postgres repository; editor definic není samostatná aplikace | `/`, `/priklepy[/:org]`, `/archiv[/:org]`, `/api/{page,archive-page,feed,selection}` | Core |
| Games, Game Center, Game Report, Player Card API | `public/games`, `public/game-report*`, season-games/game-report/player-card/extras handlers | `/games/...`, `/game-center[/...]`, `/api/games`, `/api/game-summary`, `/api/game-report-page`, `/api/player-card`, `view=extras` | Core |
| Import, backfill, webhook, pregame rankings | `api/admin`, `api/webhooks`, process-finished-game, pregame-rankings handler | `/admin/{import-game,backfill}`, API, webhook org alias, rankings cron | Core |
| Operations | frontend + handler, org cookie; pracovní nástroj, org konfigurace nutná | `/operations`, `/api/operations` | Core |
| Registrations | CSV, týmové relace, odvolatelné odkazy, osobní údaje | `/control/apps/registrations`, `/registrations/{admin,team}`, `/api/registrations` | Core |
| Portal / Hub / Site Builder | `public/league`, public-portal handler, draft/publish | `public.heromanagementsystem.com/`, `/league/:org`, `/control/apps/public-portal`, `/api/portal` | Public |
| Universal Widgets / Insights widget | `public/widgets`, widgets handler, společný league frontend | `/widgets/:type/:org`, `/widgets/insights/:org`, `/api/widgets` | Public |
| Playoff players | `public/tools/playoff-players`, tools handler, Google Sheet a publikace | `/control/apps/playoff-players`, `/tools/playoff-players/...`, `/api/tools` | Public |
| Social Media Studio | `public/studio`, studio/studio-image handlers, PNG export | `/studio[/:org]`, `/api/studio`, `/api/studio-image` | Studio |
| Game Day, invitation, match preview, reminders | Studio moduly + game-day/match-preview handlers; připravený reminder backend není důkaz živého doručování | `/api/game-day`, `/m/:org/:gameId[/analysis]`, reminder cron | Studio |
| Team Comparison | samostatný frontend i modul ve Studiu | `/team-comparison/:org`, `/control/apps/team-comparison`, `/api/team-comparison` | Studio |
| All Stars | beta frontend, graphics/presentation, handler; historický generátor není nová Vercel aplikace | `/all-stars/:org[/:instance]`, `/control/apps/all-stars`, `/api/all-stars` | Studio |
| Photo Archive / Photo Picker | Flickr, ruční review, AI kroky; picker je sdílená komponenta | `/photo-archive`, `/control/apps/photo-archive`, `/api/photo-archive`, `/photo-picker/*` | Studio API/archiv; picker balíček |
| Broadcast Studio, OBS kanály/knihovna, thumbnail | `public/broadcast`, broadcast-handler/channel store, HMS a legacy Sheet režim | `/broadcast/...`, `/api/broadcast`, query/kanálové/control odkazy | Broadcast |
| Sponsors | aktuální API je read-only HMS katalog, žádná druhá evidence sponzorů | `/sponsors`, `/broadcast/sponsors.html`, `/api/sponsors`, `/sponsors/logos/*` | Broadcast; sdílený loader balíček |
| LIVE Show Control | `public/show-control`, audio/TTS, místní ledger; dnes používá Broadcast LIVE API | `/show-control`, alias `/studio/announcer` | Show |
| Media Mapping, audio knihovna a upload | frontend/handler, `src/browser`, media catalog a Blob token endpoint | `/media-mapping`, alias `/studio/media-mapping`, `/api/media-mapping`, `/media/*` | Show |
| HERO Virtual Camera V1 | beta frontend + handler, nezávislá na HMS org/zápasu | `/virtual-camera`, `/virtual-camera/output`, `/api/virtual-camera`, fragment session klíče | Camera |
| Organization Import | handler/page v `src/server.js`; odpovídající samostatná Vercel API routa chybí | lokální/admin kontrakt; nezaměnit s veřejnou live aplikací | Core |
| Nepřipojené karty mapy | Statistics, Standings, Team Profiles, Medals, Player Comparison, Hall of Fame, Playoff Bracket, Betting, Calendar a další placeholders | žádné nové URL nevymýšlet; některá data už existují ve widgetech/vrstvách | žádný nový projekt |
| Externí HMS, TV/YouTube a další externí odkazy | nejsou lokální deployables | původní odchozí odkazy | mimo repo |

Úplné API entrypointy: `api/admin/{backfill,import-game}.js`, `api/{archive-page,backfill-page,feed,game-report-page,game-summary,health,import-game-page,page,selection}.js`, `api/webhooks/hms/game-finished.js`. Crons jsou rewrites do multiplexeru, nikoli další API soubory.

`api/game-summary.js` staticky importuje a vytváří handlery 20 `view` větví a default summary. Chyba importu/balení jednoho modulu tak může poškodit ostatní aplikace. `src/server.js` je druhý router; lokální úspěch není důkaz parity Vercel rout. `api/health.js` ověřuje jen přítomnost tří env hodnot, ne dosažitelnost DB/HMS nebo zdraví aplikací.

## Úložiště a přístupy

| Model / služba | Vlastník a konzumenti | Izolace a migrační pravidlo |
|---|---|---|
| Neon `games`, `player_game_stats`, `goalie_game_stats`, `team_game_stats`, `detected_priklepy` | Core zapisuje, Studio/Broadcast/Public čtou modely/historii | org UUID ve filtrech; `games.event_snapshot` je sloupec, nikoli tabulka; žádná změna schématu |
| `pregame_rankings` | Core cron a reporty | cron nyní explicitně PHM; nekopírovat do všech projektů |
| `hms_tool_instances` | JSON draft/published/revision, PK `(tool,organization,slug)` | sdílená tabulka, různí logičtí vlastníci níže |
| tool `public-portal[-preview]` | Public | namespace dle VERCEL_ENV |
| tool `media-mapping[-preview]`, `media-assets[-preview]` | Show, ostatní čtou publikované mapy | namespace + Blob prefix `hms-media/{production|preview}/{ORG}/` |
| tool `all-stars`, default `playoff-players` | Studio / Public | **nemají automatický preview namespace**; Preview se stejnou DB může zapisovat stejná data |
| tool `photo-archive-preview` | Studio archiv; picker čte potvrzené portréty | konstantní název i v production, přípona není důkaz izolace |
| `broadcast_channels`, `broadcast_libraries` + `_preview` | Broadcast | production jen při VERCEL_ENV=production a ne BROADCAST_SANDBOX=1; zachovat ID/control hash/revision |
| `hero_camera_sessions` + `_preview` | Camera | read/edit hash, state, revision, freshness; zachovat existující relace |
| `hms_registration_links`, `hms_registration_rate`, `hms_registration_snapshots` + `_preview` | Core | osobní údaje, org, cookies a odvolatelné odkazy |
| `hms_reminder_settings`, `hms_reminder_jobs`, `hms_reminder_attempts` | Studio | reminder-store nemá env prefix; vlastní preview DB; bounded claim/retry |
| Blob, Git audio, `public/media/catalog.json` | Show | přímý upload tokenem, veřejné media URL; žádné přesuny/delece existujících souborů |
| Flickr a OpenAI vision | Studio archiv | fotografie externí, metadata/review v toolStore; AI explicitně spuštěná práce |
| Supabase adapter | alternativní `supabase-repository.js` | přítomnost kódu není důkaz aktivního Supabase; před realizací ověřit skutečné zapojení |
| Browser storage | Control/Camera/Broadcast/Show/Studio | origin-local; zachování původního originu chrání existující uložené relace |

SQL není jen v devíti migračních souborech: runtime má lazy CREATE TABLE. I zdánlivě read-only smoke request může inicializovat schéma; v tomto auditu nebyl poslán do produkce. Preview musí mít samostatné DB/credentials, ne kopii produkčního DATABASE_URL. Produkční společnou DB lze dočasně zachovat beze změny schématu, ale se sledovaným rozpočtem dotazů/spojení. Table-level role neoddělí různé tool namespace v jedné tabulce; nejmenší oprávnění pro tento model vyžaduje pozdější zprostředkování nebo řízené row-level řešení, nikoli rozkopírování širokého DB oprávnění.

Externí HMS core není tento repozitář. `src/hms/client.js` používá `https://public-api.prod.hms.wootera.net/api/v1`; public metadata/statistiky a obrázky mají další HMS/S3 hosty v inventuře. Sdílené knihovny: `src/domain`, HMS normalize/event snapshot, `src/app/media-engine`, org resolver/katalog, sponsor loader, picker, branding/public-output. Přesunout do workspace balíčků s explicitními dependenty. Za běhu nesmí importovat aplikaci jiného projektu. Změna skutečně společného modelu může legitimně vyžadovat test/release více aplikací.

`organizationConfig` přijímá jen serverový registry a ověřené UUID; token `HMS_{CODE}_API_TOKEN`. PHM má explicitní legacy fallback HMS_API_TOKEN; ostatní ne. Zachovat PHM/EUCHL/BNHLH/YHG i další organizace, neodvozovat identitu z názvu. Operations/Photo Archive používají org přístup a cookie `hms_ops_{org}`: HttpOnly, Secure, SameSite=Strict, Path=/api, 8h. Nový origin cookie automaticky nepřevezme. Portal/Media mají org bearer secrets, crons/webhook vlastní secrets, Camera/Broadcast capability klíče. Názvy env v inventuře jsou reference v kódu, ne potvrzení živé konfigurace. Secrets nerozdávat automaticky všem projektům.

## Routy, domény a nezávislé buildy

`vercel.json`: bez frameworku, build `node scripts/build-media-client.js`, region fra1, API maxDuration 60, includeFiles media catalog. Crons reminders `15 6 * * *` a rankings `0 23 * * *` jsou v UTC: 17. listopadu v Praze 07:15 a 00:00 následujícího dne. Host-conditioned `/` pro public.heromanagementsystem.com předchází defaultní PHM homepage; pořadí tras je kontrakt. Plný seznam všech routing a header pravidel je v JSON evidence.

Zachovat deep links `/control/apps/*` u vlastníka aplikace, nikoli automaticky v launcheru. Zachovat aliases Show/Mapping/Sponsors, report `/game-center/:id[/public]`, widgets a league společné HTML, všechny query a fragmenty. Cesty pod původními hosty se nemění, DNS ani vlastnictví produkčních domén se v tomto běhu neupravuje.

Headers jsou aplikační: private/no-store/no-referrer/noindex u citlivých dat, Camera frame pouze vdo.ninja, Show Blob media, widgets embeddable, Hub ne. Games povolují PHM/BNHLH/Webnode; samotné pravidlo `/game-center` nedokazuje headers hlubokých report URL, ty generuje i handler. Proxy musí ověřit výsledné CSP/CORS, Set-Cookie, Location, Authorization a Host/Origin validaci; žádná globální policy nahrazující rozdíly.

`public/public-output.js` podporuje oba produkční hosty, z jiného kontextu některé výstupy přepisuje na PHM. Broadcast má fallback na `hms-insights-five.vercel.app` a CORS pro `wendaar.github.io`. Sponsor fallback logo má absolutní PHM URL. Proto je nutná matice **host + path + query**, ne pouze proxy adresářů. Games například volá přímo `/api/game-summary?view=games`; přesun jen `/api/games` by nechal skrytou závislost. Gateway musí směrovat i původní `view` query do vlastníků, default summary do Core. Pokud nestačí deklarativní rewrite, malý kompatibilitní dispatcher nesmí importovat všechny handlery. Query precedence ověřit v izolovaném Preview.

Gateway drží stabilní routing, statický Control a kompatibilní root assets. Každá aplikace vlastní frontend, API i své assets; společné kořenové soubory potřebují jediného vlastníka nebo verzované aplikační kopie při zachování starých cest. Preview upstream musí být gatewayi dostupný podle deployment protection; nesmí se to řešit zveřejněním secrets klientům. Gateway je společný bod selhání a proxy může přidávat provoz/náklady. Více projektů neoddělí billing týmu, společnou DB/HMS ani account-level incidenty. Cílem je nezávislý build/release a omezení dopadu chyby aplikace.

Současné workspace obsahuje jen `.`. Potřebujeme skutečné `apps/*`, `packages/*`, unikátní package names, explicitní závislosti a Root Directory/build/API per project. Pouhé připojení repa sedmkrát nezaručí přeskočení ostatních deployů. Camera-only commit musí prokazatelně přeskočit Core/Broadcast/Gateway; změny mimo workspace mohou být globální.

Build-media-client generuje katalog a má podmíněné Photo Archive pilot/releasecheck kroky podle branch/commit markerů. Oddělit build od síťových a AI kontrol. `scripts/sync-broadcast.js` kopíruje vyjmenované soubory z Youtube-Overlays; určit zdroj pravdy a upravit sync v samostatném PR, jinak může přepsat opravy.

Ověřené oficiální podklady: [Vercel monorepos](https://vercel.com/docs/monorepos), [rewrites](https://vercel.com/docs/routing/rewrites), [limits](https://vercel.com/docs/limits). Více projektů podporuje samostatné buildy, standardní Vercel Functions nejsou WebSocket server. Ověřit konkrétní billing proxy/transferu podle plánu; žádná další placená služba se zde nezavádí.

## Spotřeba a regresní rizika

Model jedné nepřetržitě běžící instance, bez latence, není měření. Completion-based frekvence je `86400/(interval+latency)`. Lokální UI timer není automaticky síťový request.

| Činnost | Kadence | HTTP/24h model | DB/upstream |
|---|---|---:|---|
| Camera output state | GET 250ms po dokončení | 345 600 | SELECT při každém GET |
| Camera output report | 2s, in-flight guard | 43 200 | SELECT + UPDATE |
| Camera controller heartbeat | 2s po dokončení | 43 200 | SELECT + UPDATE |
| Camera dirty movement flush | kontrola po 180ms, jen dirty | podle pohybu; teoreticky ~480 000 | SELECT + revision UPDATE za přijatý PUT |
| Broadcast channel | 2s po dokončení | 43 200 | DB state/library; bez edge cache |
| Broadcast overlay/thumbnail | 15s, opening úspěšně 60s | 5 760 / 1 440 | další sponsors/league/context; kanál a iframe jsou dvě smyčky |
| Show Control LIVE | 30s default, volba 10s | 2 880 / 8 640 | Broadcast LIVE API + více HMS čtení |
| Games Today | 30s aktivní view | 2 880 × počet načtených stránek | existuje hidden/offscreen/offline pause a backoff |
| Playoff public | 900s, viditelná nepending stránka | 96 | konfigurace/Google Sheet |

Jedno Camera output + controller tedy může generovat **~432 000 HTTP a ~518 400 DB statements za den**, bez pohybových PUT a inicializace. Heartbeat/report nejprve volá `store.get`, potom `touch`; není to jen jeden SQL UPDATE. Flush v klidu neposílá nic. `requestStats()` je postMessage do VDO iframe, nikoli Vercel fetch. Video přenáší VDO.Ninja/WebRTC.

Camera nemá exponenciální HTTP backoff při 503; zastaví na 403/404. Init retry 3s, dirty flush po chybě vrací dirty a další pokus přichází při další 180ms kontrole (in-flight guard brání překryvu). Rychlé chyby tak mohou generovat další požadavky. VDO reconnect má vlastní 10–60s logiku, nezaměňovat s HTTP retry. Lokální fallback při stáří operátora nebo příjmu >8s vrací široký záběr. Hidden režii/OBS nelze jednoduše zastavit bez změny bezpečného chování.

Broadcast channel porovnává `[state,libraryRevision]`; stejný stav **nevytváří nový iframe**. Overlay porovnává vizuální JSON, `refreshing` brání překryvu, `lastSuccess` drží obraz při krátkém výpadku. Channel po 10s chyby obsah skryje; overlay po 60s, opening po 600s. Při chybě overlay retry 15s i pro opening, channel 2s. Není frontend exponential backoff ani finished stop. Zachovat signature, revision knihovny, hidden stav a hold-last-good; optimalizace nesmí vrátit blikání/reload smyčku.

Server Broadcast má instance-local cache 10s live/30s game, pending coalescing, bounded map a HMS 429 cooldown. Sponsors/league/context mají vlastní limity 60s/120s. Cache snižuje upstream čtení v jedné instanci, **ne příchozí Edge Requests**; po rozdělení projektů se automaticky nesdílí. UI rotace 100ms je lokální vykreslování.

Show LIVE nemá hidden/offline/finished stop ani exponential backoff. Timeout 15s a generation/in-flight ochrany existují. Pauza musí respektovat audio/ledger; návrat nesmí znovu přehrát historické události. Games Today už má visibility, IntersectionObserver, online, abort a backoff do 300s včetně Retry-After. Zbývá ověřit vícestránkový fan-out a pokračování Today po skončení všech zápasů; konec určit z autoritativního stavu a počítat s opravami/odklady.

Ve Studiu, Team Compare, All Stars, Operations, Portal, Widgets a Registrations inventura nenachází plošný 250ms background API polling; mají ruční akce, debounce, stránkování a lokální timery. Photo Archive má explicitní sekvenční `while` AI job přes next-analysis bez prodlevy mezi dokončenými fotografiemi: není to idle polling. Omezit práci/rozpočet na job a řešit claim/revision, přerušení a resume po 120s processing lock. Nepřidávat slepé placené AI retry. HMS klient má bounded 429 retry (default 3), některé cesty retries=0; celkový deadline je důležitý při 60s funkci.

První telemetry: 24–72h včetně přenosu/noci; počty host/path/view/action, status, p50/p95 latency, aktivní outputs/controllers, DB statements a HMS 429. Nelogovat capability klíče, Authorization, cookies ani registrační osobní údaje. Rozlišovat Edge Requests, Function Invocations, DB a externí HMS/AI. 304/cache automaticky neznamená nulové Edge účtování.

## Camera realtime: doporučený směr

**Snapshot a persistence přes Camera API, živé řízení přes autentizovaný push relay, video nadále VDO.Ninja.** Poskytovatele zatím nevolíme; bez porovnání ceny/auth/OBS kompatibility není schválena nová placená služba.

| Varianta | Posouzení |
|---|---|
| Specializovaný pub/sub nebo existující vlastní WS host | preferovaný směr: fan-out a presence bez SQL na každé zprávě; nutný provozní/cenový a bezpečnostní návrh |
| WebRTC DataChannel | potenciálně peer-to-peer; signalling, NAT/TURN, více outputs a OBS CEF; libovolný control channel přes VDO embed není ověřen |
| SSE/long polling v běžné Vercel Function | reconnect, maxDuration, buffering/compute a POST řízení; není zvolený dlouhodobý základ |
| Optimalizovaný HTTP poll | malá vratná mitigace a fallback; samotné zpomalení GET zhorší reakci, nenahrazuje realtime |

Zachovat session ID a původní read/edit klíče. API po jejich ověření vydá krátkodobý token omezený na session/roli. Read role nesmí publishovat ovládání. Relay musí ověřovat authority a freshness; output keepalive nesmí prodlužovat život operátora. Revision/epoch, payload/rate limit, snapshot při reconnectu a out-of-order testy jsou nutné. Dlouhodobý capability klíč nepatří do relay URL/logu.

Pohyb lze modelově coalescovat 10–20Hz a persistovat po krátkém debounce/ukončení interakce; **není implementováno**. Před aktivací ephemeral stavu zvolit jedinou autoritu revizí (DB/API nebo serializovaný relay writer). Dva souběžní writery jsou nepřijatelní. První prototyp drží DB autoritu a změří latency/cost, teprve pak mění persistence. Presence/status přes relay; token refresh nesmí vytvořit novou rychlou Vercel smyčku.

Lokální 8s watchdog platí i při otevřeném socketu. Relay výpadek přepne jednou na původní HTTP, bez dvou souběžných transportů; reconnect jitter/backoff. Kill switch musí oslovit i již otevřený output, např. řídkou config kontrolou, nikoli pouze env změnou pro nové načtení. Starý transport zůstává kompatibilní; žádné přepisování relací nebo nové OBS URL.

Modelovaný cíl: **>90 % méně Camera Vercel requestů**, potenciálně >95 % při řídkém snapshot/token refresh. Není to naměřený slib; část nákladů přejde na relay. DB úspora závisí na checkpoint a pohybu. Acceptance: stejné/lepší změřené p95 pohyb→obraz (pracovní cíl ≤250ms), 8s wide fallback, reconnect bez staršího stavu, dva controllers/více outputs a 30–60min reálný telefon/VDO/OBS test plus dlouhý idle test. Syntetika OBS nenahrazuje.

## Samostatně testovatelné realizační etapy

S = malý izolovaný zásah; M = více modulů/testů; L = runtime oddělení a integrace. Celá reorganizace L–XL; nejvíce práce je URL kompatibilita, preview data a reálné OBS, nikoli přesun složek. Nejde o termín/cenový závazek.

| Pořadí | Změna / soubory a služby | Náročnost / riziko | Testy a důkaz | Rollback | Potřebné nastavení |
|---|---|---|---|---|---|
| 0. Baseline | Vercel Usage, domain/project/settings export, route matrix z inventury, deployment IDs | S–M / nízké | oba hosty, path/query/headers, jeden přenos + noc, DB baseline | žádná runtime změna | read-only přístup/export Vercel/Neon chybí |
| 1. Bezpečné Preview | tool-instances/all-stars/tools/photo/reminders; oddělená test DB/Blob scope, env mapa | M / střední | všechny preview writes izolované; PHM/EUCHL/BNHLH/YHG + neznámá org fail closed | odebrat nový Preview config, žádný produkční schema zásah | nové preview credentials/DB následně schválit |
| 2. Request mitigace | Camera HTTP init/poll/dirty retry backoff; Broadcast Retry-After; Show offline/finished pravidla | M / střední | fake-clock request počty, 403/404, 429/503 recovery, nezměněný iframe, reálné OBS/audio | revert malého PR/deploymentu | bez nové služby; release samostatně |
| 3. Camera samostatný build | apps/camera, packages/camera-core, vlastní handler, původní HTTP protokol | M–L / střední až vysoké | Camera testy, query/fragment/CSP/API parita; Camera-only commit přeskočí Core/Broadcast | starý multiplexer i deployment ponechat | nový Preview project/root/build/env; bez domén |
| 4. Realtime prototyp | relay adapter/protocol, snapshot authority, auth/watchdog/fallback | L / vysoké | p95/request/DB před-po, read cannot write, reconnect/order, více klientů, reálný OBS | transport kill switch na staré HTTP, stejná session | poskytovatel/rozpočet vyžaduje schválení před placeným zapojením; CSP jen v experimentálním Preview |
| 5. Gateway + Core | apps/gateway/core, kompatibilní dispatcher, launcher/root assets bez cizích runtime importů | L / vysoké | host/path/view matrix, Host/Origin, cookie, CSP/cache; nezávislé deploymenty | původní routing + uložený deployment; samostatný gateway rollback | Preview projekty; produkční routing až autorizovaně |
| 6. Studio | Studio/Game Day/Compare/All Stars/Photo API a shared balíčky, reminder owner | L / střední až vysoké | PNG, org scope, archive claims, AI přerušení bez auto spend, reminder test mode | staré routy; stejné tool namespaces/data | samostatný build/env; jen jeden cron owner |
| 7. Show | Show/Mapping/catalog/Blob; LIVE read adapter vyjmout z Broadcast runtime závislosti | M–L / střední až vysoké | audio/TTS, ledger bez duplicit, upload org scope, aliasy | staré Show/media routy, stejná Blob URL a mapy | Preview env/token scope, nepřesouvat Blob |
| 8. Broadcast | vlastní frontend/API, sponsor balíček, sync-source pravidla, API fallback | L / vysoké | staré channel/control URL, hidden state, library revision, iframe identity, hold-last-good, skutečný OBS | routy zpět, stejné channels/hashes | Preview projekt; existující kanály nedotčené |
| 9. Public | Portal/Widgets/Playoff; verzované Core API modely | L / vysoké | host root, draft/publish, staré iframe Webnode/PHM/BNHLH, CSP/SEO | původní route manifest/deployment, published data zůstávají | Preview projekt; DNS beze změny |
| 10. Individuální cutover | vždy jen schválená aplikace | M za app / vysoké | baseline + canary test data, přenos/noc, error/latency/usage, nacvičený rollback | konkrétní app upstream na last-known-good | budoucí autorizovaný routing/env/cron zásah; v tomto PR zakázán |

Camera se nejprve oddělí bez změny protokolu, aby se chyby balení nepletly s realtime. Studio/Show před Broadcastem ověří společné modely a audio před nejcitlivějšími OBS kanály. Public poslední kvůli host root, embed a publish kontraktům. Každá etapa vlastní PR a acceptance gate; tento dokument neopravňuje produkční cutover.

Show dnes používá Broadcast API; cílově vlastní svůj LIVE read endpoint a sdílí jen build-time normalizaci/modely. Staré `/api/broadcast` zůstává pro původní klienty. Photo Picker čte schválené portréty přes stabilní API, nikoli runtime import Studia. Public/Core mají datovou závislost reportů, která musí mít verzovaný kontrakt a graceful error. Nezavádět osmý centrální API projekt soustřeďující všechny handlery.

Před přepnutím uložit commit/deployment IDs, routing manifest, env scope bez secrets v Git, DB backup a kompatibilitu starého/nového kódu. Nové schema není podmínkou. Staré deploymenty/session data zachovat. Git revert není rollback persistovaných dat nebo již otevřeného OBS klienta. Po nových 5xx, ztrátě relace, cross-org odpovědi, nečekaném skrytí/reloadu obrazu nebo regresi latency/requestů rollout zastavit a vrátit konkrétní upstream. SLO prahy určit z baseline. Reálné OBS musí ověřit vrstvy, průhlednost, rozlišení, audio a běžící kanál během deploye jiné aplikace.

## Ověření a otevřené důkazy

Po `pnpm install --frozen-lockfile` proběhl `node --test`: **620 passed, 0 failed, 0 skipped**. První pokus bez závislostí selhal na chybějícím @vercel/blob; po instalaci celá sada zelená. Lockfile a runtime se nemění. Jde o lokální baseline, ne produkční/OBS ověření. Generátor prošel celý tracked strom; routing evidence kopíruje skutečné vercel.json. Finální kontrola zahrnuje `git diff --check`.

Chybějící důkazy před realizací: deployment IDs/doménové vazby/protection, URL Usage/DB baseline, skutečné env scopes/DB role/Blob nastavení, reálný OBS/telefon a ekonomika/autorita relay. Tyto neznámé blokují produkční migraci a tvrzení o naměřených úsporách. Nebrání přípravě oddělených implementačních PR. Doporučení sedmi projektů je finální architektonické rozhodnutí tohoto auditu, nikoli už provedená infrastruktura.
