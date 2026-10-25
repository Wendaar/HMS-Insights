# HMS Control Center V1

Vstup: `/control` nebo `/control?org=phm`. Připravené organizace:
`/control?org=yhg` a `/control?org=fllh`. Neznámá organizace nikdy nepoužije PHM.
Stávající Studio, Insights, archiv, importy a Game Report mají zachované adresy.

## Registr aplikací

Veřejná konfigurace je oddělená od UI v `public/control/registry.js`.
Kategorie, popisky, stav, zdroj dat, poznámka a odkazy jsou na jednom místě.
`public/control/app.js` pouze skládá rozhraní a filtruje záznamy.
Hledání podporuje češtinu bez diakritiky; kombinuje se s kategorií a stavem.

Význam odkazů: Open = aplikace, Public = veřejný výstup, Manage = správa,
Source = datový zdroj, GitHub = zdrojový kód nebo dokumentace.
Chybějící odkaz je neaktivní a přístupně označený jako Nenastaveno.
Stavy vyjadřují úplnost registru, nikoli monitoring dostupnosti.

PHM má 25 záznamů. Ověřené lokální cesty vycházejí z `vercel.json`, serveru a
existujících souborů. Insights Definition odkazuje na pravidla v kódu, protože
samostatný editor neexistuje. Player Cards mají ověřený datový endpoint,
samostatný generátor není potvrzený. All Stars je samostatné repo
`Wendaar/PHM-All-Stars-generator`; jeho README potvrzuje veřejnou Pages adresu
a XLSX / přibalený snímek z Google Sheetu. Přímá URL Sheetu není ověřena.
Ostatní nástroje z inventáře zůstávají jasně nenastavené.

První převedený vložený nástroj je **Hráči do playoff**, samostatná karta v
Competition. Má správu, centrální konfiguraci, náhled a veřejný výstup pro iframe.
Podrobnosti a provozní podmínky: [Hráči do playoff](PLAYOFF-PLAYERS.md).

EUCHL má vlastní Studio, Insights a **Opening Studio · OBS**. Ostatní nástroje
jsou u EUCHL připravené bez přebírání PHM adres. OBS předzápasová vrstva používá
živé HMS API a vlastní stabilní adresu pro každý zápas. Viz [Broadcast](BROADCAST.md).

YHG a FLLH mají zatím vlastní prázdné záznamy bez PHM odkazů a bez formuláře
pro otevření PHM reportů. Při zapojení přidejte samostatnou konfiguraci v
`appsForOrganization` a ověřte skutečný slug organizace v serverovém registru.
FLLH se automaticky neztotožňuje s FLLLH, BNHLH ani jinou organizací.
Tato stránka nepřidává organizace do HMS ani nevytváří datová připojení.

## Game Center

`gameReportUrl` trimuje Game ID, přijímá pouze UUID shodné s validací reportu
a vrací existující `/game-center/:gameId`. Před otevřením zobrazí výsledný odkaz.
Neprovádí import ani neověřuje příslušnost zápasu k organizaci: existující report
je veřejný podle ID. Neimportovaný zápas vrátí stávající 404.
Budoucí Game Picker může předat vybrané ID stejné funkci; v této verzi se
nepřidává další načítání zápasů ani druhá implementace datové vrstvy.

## Spuštění a přístup

`npm start`, pak `http://localhost:3000/control`. Vercel používá statické soubory
v `public/control` a dva nové rewrites. Nevyžaduje další serverless funkci,
balíček, klíč ani změnu databáze. Původní statické demo v `docs` se nemění.

Jde o interní navigaci ve stávajícím prototypu bez nové autentizace.
`noindex` není přístupová ochrana; pro omezení přístupu použijte ochranu nasazení.
Veřejný registr obsahuje pouze navigační metadata, žádné tokeny, secrety ani
hodnoty prostředí. Importy nadále vyžadují svůj existující administrátorský secret.
Stránka nic nezapisuje do HMS ani databáze. Nové cesty mají lokálně i ve Vercelu
noindex, nosniff, referrer policy a omezené CSP.

## Ověření

- `node --test`: registr, organizační izolace, UUID a přesná cesta reportu,
  kombinované hledání, skutečné soubory odkazů, HTTP cesty a původní routy.
- `node scripts/control-center-browser.mjs`: skutečný prohlížeč, české hledání,
  filtry, přepínání organizací, historie, chyby ID, otevření reálné routy,
  mobilní šířka a snímky. Volitelně `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`
  a `CONTROL_TEST_OUTPUT` pro prostředí bez lokálně instalovaného Playwrightu.

## MAP V2 · 25. 10. 2026

Navazuje na původní Control Center z PR #7; je sloučený s aktuální hlavní větví,
aby zůstaly aktuální reporty, přehled zápasů, Studio i OBS kanály. Hlavní vstup
zůstává `/control?org=phm` (také `euchl`, připravené `yhg`, `fllh`).

Výchozí pohled je interaktivní mapa s HMS jako společným zdrojem a 31 nody v 11
větvích. Zobrazuje Definition/Setup → Controller/Studio → Output/Archive,
plánované Game Show a Sponsors a související hráčské/provozní nástroje.
Přerušované vazby Sponsors ukazují plánované vztahy do Broadcast a Social.
Mapa podporuje posun tažením, zoom, hledání, filtr stavů a pracovní role.
Pohled „Všechny odkazy“ zachovává všechny původní URL a doplňuje 5 datových/
provozních záznamů (celkem 30). Nový modul `public/control/map.js` odděluje
vazby a kontrakty launcherů od UI.

Kontext je uložen pod `hms-map-v2:<org>` v localStorage. Každá organizace má
vlastní seznam lig/sezon (název + volitelné Season ID), Game ID a pracovní roli.
Jde o nastavení tohoto prohlížeče, nikoli sdílené oprávnění zaměstnanců nebo
zápis konfigurace do HMS. Volba organizace sama o sobě není autorizace.
Neznámá organizace nikdy nepoužije PHM. Nový kontext lze nastavit i pro
plánovanou organizaci, její nástroje ale zůstávají neaktivní.

Dnešní zápasy se načítají na výslovné kliknutí z existujícího organizačního
`/api/broadcast?org=...&filter=Today`. Odpověď musí odpovídat právě zvolené
organizaci; opožděná odpověď po přepnutí organizace se zahodí. Seznam je
první stránka aktuálního HMS browseru; pro další zápas lze vždy zadat Game ID.
Liga/sezona se nastavuje vlastním ověřeným Season ID, katalog lig API zde
není zaveden. Games View předává Season ID stávajícímu přehledu; Game Report
zůstává veřejnou UUID adresou existujícího importovaného zápasu. OBS předává
organizaci a Game ID přes parametr `game`. Výstup používá existující režim
`mode=overlay`. Stálé kanály se nadále vytvářejí a kopírují ve Studiu.

Insights Definition vede do pravidel v kódu; samostatný editor neexistuje.
Social Output je export PNG ve Studiu, samostatná galerie se nepředstírá.
DB, API a Security vedou do schématu/kódu/dokumentace; privátní konzole nejsou
vymyšlené. Sponsors rozšíření z oddělené náhledové větve není součástí tohoto
vydání. Game Show ani chybějící adresy se neoznačují jako funkční.
Ready znamená ověřenou cestu v projektu, Beta částečné řešení, Planned plán
nebo nepropojenou položku. Nejde o živý monitoring závislých služeb.

Ověření: úplná sada Node testů, nové kontrakty launcherů, izolace kontextů,
neaktivní plánované nástroje a odolnost úložiště. Ruční browser QA přes
podporovaný in-app browser: uložení a obnovení kontextu, přepnutí organizace,
velké launchery, Planned dialog, katalog, hledání a mobilní rozložení.

## Úprava výběru kontextu a navigace

Běžné ovládání již neobsahuje textová pole pro UUID. Sezony se načítají podle
názvu soutěže a sezony přes existující Studio API (`catalog=leagues`). Zdrojem
jsou sezony importovaných HMS zápasů dané organizace. Další katalog
`catalog=games` vrací nejvýše 100 posledních načtených zápasů vybrané sezony
podle týmů a data. Oba dotazy jsou serverově omezené organizací; technická ID
se pouze interně předávají do existujících adres. Toto není úplný seznam všech
budoucích sezon v HMS; chybějící sezony musí doplnit datové napojení. Rozhraní
při prázdné nabídce nebo chybě po uživateli nepožaduje kopírování ID či URL.

Všechny odkazy na nástroje/kód/výstupy se otevírají s `target=_blank` a
`rel=noopener noreferrer`, takže mapa zůstává otevřená. Volba organizace se
nemění. Sponzoři jsou společný zdroj hned vedle HMS a první větev mapy.
Odkaz katalogu vede do skutečného samostatného náhledu nové API vrstvy,
odděleně pro PHM/EUCHL. Neprohlašuje se tím za hotové sdílení sponzorů ve
všech nástrojích.

### Sponzoři: navazující sjednocení

Evidence a vazby sponzorů musí pocházet z nové HMS API vrstvy, stejně jako
v aktuálním sponzorském náhledu Broadcast Studia. Media Studio má dosud
samostatné ruční nastavení; jeho převod a převod dalších nástrojů je
naplánovaný. Při převodu zachovat existující nastavení a rozlišit HMS evidenci
od pravidel zobrazení pro konkrétní výstup. Nepředstírat hotové propojení.

### Přístup do playoff správy

Publikování zatím chrání serverový přístupový kód organizace. Není to
přihlášení uživatele do HMS. Nový read-only `action=access` sděluje pouze,
zda je přístup nastavený; nevrací kód, neodemyká změny a neoslabuje původní
ověření. Pokud přístup není nastavený, UI zobrazí čekání na zprovoznění správy,
nikoli formulář vyžadující neznámé heslo. Veřejný výstup je dostupný bez kódu.

### Nové nástroje: nejdříve do mapy

Každý nový HMS nástroj nejprve přidat do registru a odpovídající větve mapy
jako Planned. Uvést, odkud čte data a kam jeho výstup patří. Teprve po ověření
skutečné adresy a chování přidat launcher a změnit stav na Beta nebo Ready.
Nezakládat další samostatný rozcestník. Zachovat trvalý vstup `/control`.

## Veřejné Insights v CZ / EN a čitelné odkazy

Veřejný výběr i archiv podporují `?lang=cs` a `?lang=en` a mají přepínač CZ/EN.
EUCHL má bez parametru výchozí angličtinu, PHM češtinu. Jazyk se předává při
filtrování, načítání dalších karet, sdílení a přechodu z reportu. Popisy výkonů
se skládají ze skutečných `facts`; uložené názvy, statistiky a JSON zůstávají
beze změny. Angličtina zahrnuje UI, filtry, data, karty i jejich detaily.

Přehledy zápasů mají čitelnou adresu `/games/<organizace>/<sezona>`, např.
`/games/euchl/2026-2027`. Pokud má organizace ve stejném období více soutěží,
přidá se název soutěže: `/games/phm/phm-cup/2026-2027`. Nejednoznačné názvy
se nikdy nepřiřadí náhodnému UUID. Tyto adresy se odvozují z ověřeného katalogu
načtených sezon; názvy v URL se znovu ověří vůči dané organizaci.

Staré odkazy s `seasonId` zůstávají funkční. Pokud je k nim v databázi ověřená
jednoznačná čitelná cesta, prohlížeč ji sám nahradí bez změny vybraného období.
Například filtr posledního týdne má tvar `?period=last-week`. Jazyk výchozí
pro danou organizaci lze z adresy vynechat. Tlačítko Kopírovat odkaz kopíruje
aktuální sdílenou adresu. Další filtry se uchovávají; tento krok neodstraňuje
ID případných jednotlivých týmových/skupinových filtrů ani reportů zápasů.

### Vlastní doména

Dlouhá doména s `git-codex-...vercel.app` je adresa náhledu. Čitelné cesty řeší
část za doménou; vlastní doména/subdoména řeší jméno hostitele. Je možné
použít např. `app.phmcup.cz`, pokud to vlastník zvolí, nebo subdoménu společné
značky HMS. Příklady nejsou připojené ani zarezervované domény.

V existujícím projektu Vercel se zvolená doména přidá v Settings → Domains.
Potom se u poskytovatele DNS nastaví přesně záznam, který Vercel pro tento
projekt ukáže. Nevymýšlet univerzální cílový CNAME, neměnit DNS hlavního webu
ani e-mailů a nepřesouvat kvůli tomu celý projekt na nové hostování. Před
přepnutím návštěvníků je nutné nasadit ověřenou verzi do zamýšlené cílové
větve a zkontrolovat správné přiřazení domény. Tato úprava DNS ani domény
sama nemění a nevytváří nový projekt.

## Access audit (25. 10. 2026)

MAP now shows a second classification independently of Ready/Beta/Planned:
PUBLIC (intended read-only fan-facing page), STAFF (operator tooling), ADMIN
(configuration and infrastructure), PLANNED (not implemented). All are currently
**unverified access intentions**, not security guarantees or uptime tests.
The labels do not authenticate or restrict requests. In particular, Vercel
preview domains can require Vercel Authentication even for intended PUBLIC URLs.
Never embed preview links on public sites. Verify the production deployment and
its routing using an unauthenticated/incognito browser and ensure production
Deployment Protection is configured appropriately in Vercel settings. Do not
weaken protection of write APIs, admin secrets, or staff operations merely to
make Games View public. Public embeds additionally require frame-ancestor CSP
and cookies/headers to permit the intended embedding domain. The /games route
currently has frame-ancestors 'none', therefore public display does not yet
imply iframe readiness. Do not mark it embed-ready without a targeted CSP change
and verification.
