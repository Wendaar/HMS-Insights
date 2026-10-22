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

PHM má 24 záznamů. Ověřené lokální cesty vycházejí z `vercel.json`, serveru a
existujících souborů. Insights Definition odkazuje na pravidla v kódu, protože
samostatný editor neexistuje. Player Cards mají ověřený datový endpoint,
samostatný generátor není potvrzený. All Stars je samostatné repo
`Wendaar/PHM-All-Stars-generator`; jeho README potvrzuje veřejnou Pages adresu
a XLSX / přibalený snímek z Google Sheetu. Přímá URL Sheetu není ověřena.
Ostatní nástroje z inventáře zůstávají jasně nenastavené.

První převedený vložený nástroj je **Hráči do playoff**, samostatná karta v
Competition. Má správu, centrální konfiguraci, náhled a veřejný výstup pro iframe.
Podrobnosti a provozní podmínky: [Hráči do playoff](PLAYOFF-PLAYERS.md).

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
