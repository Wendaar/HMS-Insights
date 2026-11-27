# Broadcast Studio V2 — Director Control

V2 je od 27. 11. 2026 dostupná na `https://app.phmcup.cz/broadcast/v2.html` po výslovném schválení vlastníkem, PR #83. Původní studio a OBS adresy zůstávají zachované; žádný existující živý kanál se automaticky nepřevádí. Ovladač rozlišuje produkci a sandbox podle serverového capabilities endpointu, nikoli podle hostname. Testovací postupy níže patří lokálnímu/sandbox prostředí.

Původní větev: `codex/broadcast-studio-v2`. Výchozí auditovaný commit: `95e7b43` z `origin/main`, 26. 11. 2026. Během implementace a testů nebyly ovládány produkční kanály.

## Audit před implementací

Prostudováno: `AGENTS.md`, `project-docs/HMS_OVERVIEW.md`, `project-docs/APPLICATIONS.md`, `docs/BROADCAST.md`, partnerské vrstvy, rozšíření Broadcast, sponzoři HMS, Team Comparison; ověřen příslušný kód a testy. Některé historické dokumenty popisují V1 před rozšířeními; rozhodující je aktuální kód. Veřejná produkční URL při pokusu o čtení webovým nástrojem nebyla přístupná. Uživatelské screenshoty sloužily jako vizuální reference; nebyl ovládán živý kanál.

| Oblast | Skutečná implementace a zjištění |
| --- | --- |
| Ovladač a renderer | `public/broadcast/app.js`, `match-layers.js`, `extra-layers.js`, `league-layers.js`; stejný frontend vykresluje control, overlay a thumbnail. V1 při změně parametrů volá `channel.publish()`. V2 musí tento automatický přenos vynechat. |
| Stabilní OBS kanál | `channel.js` → `/api/broadcast?channel=…`, `src/web/broadcast-channel.js`. Jedna URL `index.html?mode=channel&channel=…`, čtení po 2 s, CAS revize, veřejné náhodné ID, soukromý klíč v lokálním úložišti, na serveru SHA-256. V1 vykresluje jednu iframe a při změně celého stavu ji nahrazuje. |
| Přímé overlaye | `mode=overlay&org=…&game=…&layer=…` obsahují pevné nastavení a nepodléhají ovládání stabilního kanálu. Nejsou duplicitou stabilní URL; musí zůstat pro staré scény. `mode=thumbnail` je další odlišný účel. |
| Databáze | Existující Neon/PostgreSQL přes `DATABASE_URL`: JSONB stav kanálu a knihovna, žádné sportovní zápisy. Produkce používá `broadcast_channels`/`broadcast_libraries`, preview a lokální běh jejich `_preview` varianty. Bez nových migrací/sloupců. |
| HMS | `broadcast-handler.js` → organizační registr, `/game`, metadata, organizace, při `live=1` události a sestava. Ověření organizace i game ID; žádný cizí/PHM fallback. `/api/broadcast` využívá existující Vercel funkci přes rewrite. |
| Cache a aktualizace | Server game/live cache 30/10 s, omezení 100 záznamů, slučování souběžných dotazů a limit 8 rozpracovaných čtení. Živé overlaye 15 s, úvod 60 s; stav kanálu 2 s. Sponzoři mají vlastní krátkou cache. |
| Sponzoři | Sdílený `/api/sponsors`, `sponsors/model.js`, `rotation.js`, `partner-playlist.js`; skutečná UUID a vazby týmů, výslovný výběr z organizačního katalogu, čas zobrazení/pauzy a vlastní doplňky. Organizace se kontroluje. Vazba soutěže není v Broadcast modelu zápasu bezpečně přenesena; V2 ji neodhaduje. |
| Soupisky/góly | `broadcastMatch()` ověřuje týmy a konzistenci gólů vůči oficiálnímu skóre. Původní renderer má 20/12 hráčů nebo 8 gólů na stránku. Absence událostí není automaticky nulové skóre. |
| Insights / TOP 5 | Zápasové vícebodové výkony a hattricky ze stejných ověřených událostí; sezonní TOP 5 a tabulka z `broadcast-league.js`, oficiálního HMS a společných widget statistik; PP/PK/program/historie přes `broadcast-context.js`. |
| Team Compare | Existující Studio editor a canvas renderer `public/team-comparison/graphics.js`, odlišný scope/model a asynchronní mediální pipeline. Nemá hotový Broadcast adaptér pro automatické svázání přesného zápasu. V2 jej pravdivě označuje jako další etapu. |
| Fotografie | Sdílený photo picker a `photoChoices` ověřované serverem; veřejná HMS fotografie a korektní fallback. V2 nemountuje globální editor ani nevybírá hráče implicitně. Existující uložené volby konkrétního zápasu/organizace se dále přenesou při SHOW. |
| Rizika pro přenos | Automatické publish při přípravě, sdílení klíče V1, přepnutí organizace, souběžné zápisy, opožděné HMS odpovědi, výměna iframe při každé změně, změny živé knihovny, historická synchronizace z Youtube-Overlays. V2 je odděluje nebo omezuje. |

## Spuštění a bezpečné testování

1. V izolovaném checkoutu této větve spusťte `pnpm install --frozen-lockfile`.
2. Pro skutečná data použijte stávající serverové HMS připojení organizací a `DATABASE_URL`. Klíče nepatří do browseru ani URL. Nastavte `BROADCAST_SANDBOX=1`, potom `npm start` (výchozí port 3000). Lokální běh i bez `VERCEL_ENV` standardně používá preview tabulky; sandbox je další pojistka.
3. Otevřete `http://localhost:3000/broadcast/v2.html?org=PHM`, případně `&game=<HMS_UUID>&lang=en`.
4. Vyberte zápas, vytvořte **nový testovací kanál**, jeho jedinou doporučenou URL vložte do samostatné testovací OBS scény 1920×1080. Nepřenášejte do ní produkční ovládací klíč.
5. Výběr karty, metriky, týmu, jazyka nebo zápasu mění jen PREVIEW. SHOW MAIN publikuje jeho nastavení. SHOW SPONSORS publikuje samostatný připravený výběr. HIDE MAIN zachová partnery, HIDE SPONSORS zachová MAIN.

V2 používá samostatný lokální klíč `hms-obs-director-v2` a soukromý fragment `#director=…`. Klíč V1 `hms-obs-control-v1` ani fragment `#control=…` se automaticky nepřebírají. Pouhé otevření V2 nevytváří kanál ani nic nepublikuje. Po založení je V2 kanál skrytý. Obnovení stránky pouze přečte PROGRAM.

Na Vercel preview ponechte ochranu preview zapnutou. URL se automaticky nepřesměruje na produkční doménu. Pokud OBS skončí na přihlášení Vercelu, použijte lokální sandbox nebo schválený přístup, ochranu nevypínejte.

## Vrstvy, náhled a bezpečnost

- Čtyři kategorie obsahují všechny existující typy rendereru, včetně QR, velkého oznámení, tabulky, historie a příštích zápasů. Nedokončené adaptéry mají stav UNAVAILABLE s vysvětlením.
- Desktop má karty a kontextové ovládání vlevo, sticky PREVIEW a PROGRAM s bezpečnostními tlačítky vpravo. Dialog zápasů se po výběru zavře. Na úzké obrazovce je náhled nad kartami.
- V2 stav rozšiřuje dosavadní JSONB o `directorVersion:2`, `mainVisible`, samostatné `sponsors` a snapshot prezentačního výběru `libraryItems`. Staré stavy a URL jsou nadále platné. Snapshot kopíruje vysílací volby/referenční UUID, nikoli další upravitelný katalog HMS. Vlastní malé rastrové doplňky využívají dosavadní validaci knihovny; celkový request má limit 4 MB.
- Jeden Browser Source obsahuje dvě nezávislé iframe se stávajícím rendererem. Při změně grafiky/parametrů stejného zápasu se MAIN aktualizuje přes ověřenou zprávu od rodiče na stejném originu. SPONSORS nepřechází na novou URL ani nezačíná rotaci od začátku. Při změně organizace/zápasu se rámec vymění, aby stará data nemohla proniknout do nového scope.
- SPONSORS jsou standardně nad MAIN, včetně plných infografik. V panelu SPONSOR LAYER lze vybrat každý ze čtyř rohů a režim **Nad hlavní grafikou** / **Skrýt při kolizi s hlavní grafikou**. Druhý režim je výslovná volba; překrytý partner má stále zapnutý uživatelský stav a fáze rotace pokračuje. Pozice a režim se do PROGRAM přenesou až přes SHOW SPONSORS.
- `PATCH {action:'hide-all'}` je autentizovaný atomický zápis. Nečte HMS ani fotografie, nepotřebuje aktuální klientskou revizi, zvýší serverovou revizi a skryje obě vrstvy. Starší SHOW pak selže na CAS. Lokální BroadcastChannel/storage signál ihned vyprázdní stejný origin, včetně ochrany před opožděnou odpovědí. Neúspěšné potvrzení se označí a opakuje.
- Vzdálené OBS dostane HIDE přes dosavadní dvousekundové čtení kanálu. Při výpadku spojení zůstává původní fail-closed limit 10 s. Okamžité doručení vzdálenému OBS bez funkční sítě nelze garantovat; UI nezaměňuje lokální skrytí a potvrzení serveru. Samotná HMS chyba nemá vliv na nouzový příkaz.
- Příprava dalšího insightu nemá implicitního hráče. Je nutný explicitní výběr výkonu před SHOW. Globální panel fotografie V2 neobsahuje; V1 a datové integrace zůstávají zachovány.

## Kompaktní výstupy

Opt-in `layout=compact` a V2 používají původní renderery a ověřený model, s novým stylesheetem `compact.css`. Staré přímé URL mají původní layout.

- Soupiska: dva sloupce hráčů na tým, běžných 20 hráčů jednoho týmu nebo 20+20 najednou. Bez stránkového ovládání, pokud obsah nepřesáhne bezpečnou kapacitu. Výchozí limit je 24 hráčů jednoho týmu / 20 na tým při obou. Neobvykle dlouhá jména kapacitu konzervativně sníží. Větší soupiska má ruční, předvídatelné stránky bez automatického otáčení.
- Góly: chronologická dvousloupcová mřížka respektující pořadí HMS, čas, střelce, asistence a tým. Čte se **shora dolů vlevo, potom shora dolů vpravo**. Běžných sedm na jednom obrazu; kapacita až 16 se sníží pro delší jména střelců/asistentů, více s ručním stránkováním. Neověřené události se nevydávají za platný přehled.
- Čísla, jména a loga mají fallbacky bez smyšlených hodnot. Fotografie nejsou podmínkou dostupnosti soupisky; takový stav je INCOMPLETE.

## V2.1 a hranice

Připravené, ale nevysílatelné karty: Countdown, Starting Goalies, Team Compare, Goal, Goalie Statistics, Highlights, Next Period, Game Statistics, Three Stars, MVP a Thank You. Některé mají data nebo komponentu jinde v HMS, ale chybí ověřené napojení a broadcast kontrakt; nejde o tvrzení, že v celém HMS neexistují. Stávající stav skóre podporuje konečný výsledek a období. Neobsahuje živou časomíru ani automatické hlášení gólu.

Další etapa: přímo sdílet Team Compare canvas/model s kontrolou scope zápasu; adaptér oficiálních hvězd a brankářů; explicitní timeout/copy pro countdown/thank-you; jemnější důvody nedostupnosti u částečně selhaných league/context odpovědí; organizační/soutěžní presety až s ověřeným UUID kontextem a oprávněními. Kompletní editor fotografií se zde neimplementuje.

## Výkon a navazující měření

V2 controller obnovuje detail po 15 s, metadata/kontext/katalog nejvýše jednou za 60 s. Seznam zápasů čte pouze dialog. Existující serverové cache a coalescing zůstávají; rotace samotná nevolá API, používá `sponsorFrame()` a mění DOM jen při změně položky, průhlednost podle původního algoritmu. Nezměněné parametry nevyvolávají navigaci rámce.

Po uživatelském testování se V2 renderer plní daty z rodiče: pracovní PREVIEW okamžitě použije už ověřený model controlleru a nespouští vlastní čtení HMS. PROGRAM má jeden společný omezený reader `director-data.js` pro obě vrstvy, s oddělením organizace/zápasu a slučováním souběžných čtení. Doručení dat samo nemění publikační stav. League, context a katalog se v controlleru dokončují nezávisle, takže pomalý context nezablokuje partnery nebo TOP 5. Pracovní preview partnera drží zvoleného/prvního partnera, zatímco PROGRAM dál respektuje rotaci/pauzy.

Program příštích zápasů server nově získává přes existující `readSeason()` (omezený a cachovaný index), nikoli 28 volání `browseSeasonGames()` pro dvojici týmů a 14 dnů. Filtr týmů, ověřená sezona a 14denní okno zůstávají. Tato serverová optimalizace je zatím pouze ve větvi; lokální náhled čte dosavadní veřejné produkční API s vlastní krátkou cache a slučováním dotazů. Zrychlení skutečného studeného HMS/Neon čtení se tím automaticky neprohlašuje za produkčně nasazené.

Exportní html2canvas se načte až po požadavku na stažení YouTube miniatury. OBS/preview jej nepotřebují a při startu již nečekají na CDN. V2 renderer oznamuje připravenost rodiči přímo po inicializaci modulu, nikoli teprve po dokončení všech vedlejších zdrojů stránky. Původní thumbnail export zůstává dostupný.

Pro následnou optimalizaci měřit odděleně: počet skutečných upstream HMS čtení (ne pouze požadavků browseru), cache hit rate, p95 endpointů, paměť a CPU OBS Browser Source při dvou vrstvách, dekódování obrazových doplňků a skryté vrstvy, obnovení po síťovém výpadku. Potom zvážit sdílený datový přenos oběma rendererům, samostatnou cache sestavy a log a delší obnovu čistě sponzorského rámce. Bez reálného OBS/YouTube měření se zde neuvádí úspora CPU nebo změna kvality přenosu.

## Nasazení a rollback

Nejdříve dokončit lokální a chráněné preview ověření na skutečných utkáních PHM/EUCHL, dlouhých jménech a reálném OBS 1920×1080. Teprve po výslovném schválení nasadit přes obvyklé PR/Vercel workflow; nepřepisovat vstupní `/broadcast/index.html` na V2. Obsluha přejde opt-in na `/broadcast/v2.html`. V2 může vytvořit nový kanál; stávající produkční kanály se automaticky nemigrují.

Rollback obsluhy: vrátit se na původní `/broadcast/index.html` a dosavadní Browser Source/kanál, V2 zdroj skrýt. Rollback kódu: vrátit schválené V2 commity / předchozí deployment; žádná databázová migrace se nevrací. Před návratem starého kódu ponechat V2 kanály skryté, protože starý renderer neumí jejich vícevrstvý stav. Neobnovovat produkční stav z preview tabulek.

Historický `scripts/sync-broadcast.js` kopíruje část souborů z Youtube-Overlays. Před jeho dalším použitím je nutné sladit nové změny `app.js`, `channel.js` a `match-layers.js` s upstreamem; slepé přepsání by odstranilo V2 bridge. V2 nepřidává druhý datový nebo grafický engine.

## Testy

Výsledky akceptačních scénářů a meze ověření: [BROADCAST-V2-TESTS.md](BROADCAST-V2-TESTS.md).

`node --test` zahrnuje nové `test/broadcast-director.test.js`: validace V1/V2, oprávnění, atomické hide proti staršímu SHOW, kolize, pravdivá dostupnost a kapacity kompaktních layoutů.

`node scripts/broadcast-director-browser.mjs` vyžaduje Playwright (lze předat `PLAYWRIGHT_MODULE` jako importovatelnou cestu/URL), na Windows použije instalovaný Edge nebo `CHROMIUM_PATH`. Běží s in-memory úložištěm a výslovnými testovacími daty, bez HMS/Neon zápisů. Výsledky, screenshoty a počítadla požadavků zapisuje do `artifacts/broadcast-v2/`. Nenahrazuje reálný test v OBS ani schválení produkce.
