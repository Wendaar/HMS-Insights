# Opening Studio / OBS · předzápasová vrstva

Frontend pochází z `Wendaar/Youtube-Overlays`. Zde je synchronizovaná kopie v
`public/broadcast`, aby mohl OBS používat UI a API na jedné doméně. Aktualizace:
`node scripts/sync-broadcast.js cesta/k/Youtube-Overlays`. Nepřepisujte kopii ručně.
Podklady PHM zůstávají ve zdrojovém repo; EUCHL používá neutrální SVG bez PHM značek.

## Vstup a OBS

- Ovládání: `/broadcast/index.html?org=EUCHL`
- Konkrétní zápas: přidejte `&game=HMS_GAME_ID`, případně vložte HMS odkaz do formuláře.
- OBS: stejná adresa s `mode=overlay&source=hms`; Browser Source 1920 × 1080.
- Miniatura: `mode=thumbnail`, bez exportního tlačítka `&clean=1`.
- Není potřeba API token v URL, login ani zásah do Sheetu.
- Oddělené URL drží organizaci a zápas; více stadionů se vzájemně nepřepíná.

Ověřovací zápas dodaný uživatelem: EUCHL,
`6C02DF50-CE27-11F1-A5F0-6320901B5AD5`. Veřejná HMS data v době implementace
uváděla Prague Guardians – Bratislava Capitals, 23. 10. 2026 v 21:15,
ICERINK (Yellow) - Prague CZ. Rozhodčí a časoměřič nebyli vyplnění.
Samostatně bylo ověřeno, že produkční připojení EUCHL ve Studiu čte tento
neodehraný zápas z HMS, nikoli z importovaného snapshotu.

## API a ochrana organizačních dat

`/api/broadcast` je rewrite do existující funkce GameSummary s `view=broadcast`;
žádná další Vercel funkce. `src/web/broadcast-handler.js` používá stávající
serverový registr a HMS_<ORG>_API_TOKEN / ORGANIZATION_ID. EUCHL nikdy nepoužije
PHM token. Chybějící připojení nebo cizí gameId se neřeší náhradním zápasem.

GET s gameId čte `/game`, ověří oba identifikátory a vrací jen týmy, loga,
lokální datum/čas, soutěž/skupinu/fázi, místo a veřejné zobrazovací názvy pořadatelů.
Nečte celé události ani soupisky a nic nezapisuje do HMS ani DB. Organizační logo
je volitelné z `/organization`. Výstup má verzi 1, původ `HMS API` a čas čtení.
Chybějící údaje zůstávají prázdné. Žádné skóre ani živá časomíra se neodvozují.

GET bez gameId používá stávající bounded HMS browser se status=ALL, 20 zápasy na
stránku a kalendářními filtry Europe/Prague. Ovládání ukazuje prvních 20 a dovoluje
přesné otevření dalších zápasů odkazem/ID. Nedělá neomezený download celé historie.

CORS povoluje `https://wendaar.github.io` pro zdrojový GitHub Pages frontend;
server nikdy nepřijímá token z prohlížeče. Přímé veřejné HMS API vrací CORS pro
vlastní HMS origin, proto se nepoužívá jako přímý zdroj v Browser Source.
Server slučuje souběžné požadavky a drží 30s cache nejvýše 100 zápasů.

Overlay obnovuje po 60 s bez změny URL. Při chybě se pokus opakuje po 15 s.
Krátký výpadek zachová ověřený obraz, po 10 minutách se vyčistí; počáteční chyba
je průhledná. Nezobrazuje technické chyby ve vysílání a nepřeskakuje na jiný zápas.
Provozní chyby jsou viditelné v ovládání a konzoli. Původní Sheet je dostupný
jen výslovně přes `source=sheet&org=PHM` kvůli kompatibilitě.

## Ověření

`node --test`: mapování předzápasových dat, ochrana ID a organizačního tokenu,
vynechání kontaktů/secretů, cache/coalescing, CORS a chyby bez PHM fallbacku.
`node scripts/broadcast-browser.mjs` (Playwright): controller a přesná OBS URL,
1920 × 1080 transparentní výstup, EUCHL bez PHM značek, lokální čas,
miniatura, vložení HMS odkazu, mobilní ovládání, žádný Sheet request,
skutečný 60s refresh, zachování ověřené vrstvy při výpadku a průhledný první error.
Volitelně PLAYWRIGHT_MODULE, CHROMIUM_PATH, BROADCAST_TEST_OUTPUT.

Tato verze tvoří základ předzápasové grafiky pro OBS. Živé skóre, časomíra,
přepínání ingame událostí a OBS WebSocket řízení nejsou součástí tohoto přírůstku.
