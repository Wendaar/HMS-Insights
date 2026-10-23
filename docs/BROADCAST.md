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
Chybějící popisky doplní z veřejných metadat až po shodě obou týmových UUID a data
s ověřeným zápasem. Nepočítá události ani nevrací soupisky a nic nezapisuje do HMS ani DB. Organizační logo
je volitelné z `/organization`. Výstup má verzi 1, původ `HMS API` a čas čtení.
Chybějící údaje zůstávají prázdné. Žádné skóre ani živá časomíra se neodvozují.

GET bez gameId používá stávající bounded HMS browser se status=ALL, 20 zápasy na
stránku a kalendářními filtry Europe/Prague. Ovládání ukazuje prvních 20 a dovoluje
přesné otevření dalších zápasů odkazem/ID. Nedělá neomezený download celé historie.

CORS povoluje `https://wendaar.github.io` pro zdrojový GitHub Pages frontend;
server nikdy nepřijímá HMS integrační token z prohlížeče. Přímé veřejné HMS API vrací CORS pro
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
# Zápasové vrstvy a jazyky

V ovládání je přepínač CZ/EN. Jazyk se přenáší do samostatné OBS adresy jako `lang=cs` nebo `lang=en`. Názvy týmů a osob se nepřekládají.

Volba **Vrstva** nabízí předzápasovou grafiku, stav po třetinách, soupisku, přehled gólů a kompaktní insights. Každá volba vytváří vlastní URL: `mode=overlay&layer=opening|periods|lineup|scoresheet|insights`. Rozlišení všech zdrojů zůstává 1920×1080 s průhledným okolím. Původní adresy bez `layer` a `lang` zobrazují českou předzápasovou vrstvu.

- `side=home|away|both`: tým pro soupisku nebo góly.
- `period=current|1|2|3`: aktuální/oficiální výsledek nebo součet zapsaných gólů do zvolené třetiny. Volba třetiny je na obsluze; aplikace neurčuje, zda třetina již skončila.
- `page=1…`: stránka soupisky (20 hráčů jednoho týmu, 12 při zobrazení obou) nebo gólů (8 na stránce).
- `insight=<playerId>`: konkrétní výkon; bez výběru první dostupný. Hattrick znamená alespoň 3 góly, vícebodový výkon alespoň 2 body z gólů a asistencí. Zrušený výkon se při aktualizaci odstraní.

Pro společný vzdáleně ovládaný výstup použije obsluha **Vytvořit OBS kanál** a **Kopírovat stálou OBS adresu**. Tato adresa (`mode=channel&channel=<id>`) se do OBS vloží jednou, rozlišení 1920×1080. Přepnutí zápasu, jazyka, vrstvy a parametrů v ovládání se pak automaticky přenáší do tohoto kanálu. **Skrýt v OBS / Zobrazit v OBS** nezávisle řídí viditelnost. Když je kanál skrytý, další změny jej samy nezapnou. Přenos změn trvá obvykle přibližně 2 sekundy plus načtení zápasových dat.

Samostatná tlačítka **Kopírovat OBS URL** a **Otevřít čistý náhled** zachovávají přímé adresy dané vrstvy pro předem připravené scény. Tlačítko **Obnovit z HMS** aktualizuje nabídku dostupných insightů v ovládání.

Kanály jsou v oddělené tabulce `broadcast_channels` v existující PostgreSQL databázi (`DATABASE_URL`), vytvořené při prvním použití. Restart nebo další nasazení kanál nezruší. Veřejné ID obsahuje 192 náhodných bitů; zápis vyžaduje samostatný 256bitový ovládací klíč. V databázi je pouze jeho SHA-256 otisk. Klíč se vrací jednou při založení a ukládá pod `hms-obs-control-v1` do místního úložiště ovládacího prohlížeče. Není v OBS URL ani veřejné odpovědi. Pro přenos do jiného prohlížeče použijte Zálohovat soukromý odkaz k ovládání. Klíč je pouze ve fragmentu odkazu za #, neposílá se v HTTP URL na server a po importu se z adresního řádku odstraní. Odkaz uschovejte soukromě; umožňuje měnit vysílaný výstup.

Veřejný výstup sleduje serverový stav po 2 sekundách, nezměněný stav nerestartuje grafiku. Při výpadku spojení delším než 10 sekund se výstup skryje a po obnovení spojení znovu načte. Zápis používá kontrolu verze: starší záložka nepřepíše novější stav bez výslovného opětovného odeslání přes **Odeslat aktuální náhled do OBS**. Po obyčejném obnovení ovládací stránky se její náhled neposílá automaticky; již běžící výstup pokračuje. Kanály zapisují jen stav prezentace, nemění sportovní data v HMS ani existující tabulky výsledků.

`/api/broadcast?org=EUCHL&gameId=<uuid>&live=1` přidává k dosavadnímu modelu pole `match`. Server čte `gameEvents` a `gameLineup` stejným organizačně omezeným tokenem jako detail zápasu; výsledky nezapisuje do HMS ani databáze. Nové vrstvy se obnovují po 15 sekundách, server je ukládá do mezipaměti na 10 sekund. Po minutě výpadku se stará zápasová vrstva skryje; předzápasová vrstva zachovává původní režim.

Odvozené výsledky po třetinách a insights vznikají pouze při souladu počtu gólů s oficiálním skóre a příslušností všech gólů k daným týmům. Třetina se neodhaduje z času. Chybějící soupiska, neúplné události a upravený výsledek se oznamují ve vrstvě; neznámé hodnoty se nemění na vymyšlené statistiky. Čas události je převzat z HMS, nejde o živou časomíru. Přehled gólů nenahrazuje úplný oficiální zápis s tresty a podpisy.
