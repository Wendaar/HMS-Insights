# HERO Virtual Camera V1

Otevřete `/virtual-camera` (také karta v Control Center → Media). Neinstaluje se plugin do OBS. Režisér dostane webové ovládání, OBS vlastní webovou stránku jako Browser Source, 1920 × 1080. Grafika a skóre zůstávají samostatnými zdroji nad kamerou. Žádné Game ID, organizace ani HMS API nejsou potřeba.

## První použití

1. Otevřít `/virtual-camera`, vložit přijímací `https://vdo.ninja/?view=…` pro jedinou kameru a kliknout Připojit kameru. Podporován je i panoramatický vstup 32:9. Rozhodující je skutečně doručený obraz z VDO.Ninja.
2. Myší / šipkami posouvat výřez, W přiblížit, S oddálit, R reset; Shift jemně. Fungují malá i velká písmena a také +/− včetně numerické klávesnice. Předvolby 1×, 1.5×, 2×, 3×; slider až 4×. Volitelné vyhlazení 250 ms. Při psaní do polí se kamerové zkratky nespouštějí.
3. Zkopírovat nabídnutý výstupní odkaz do OBS → Zdroj Prohlížeč, 1920 × 1080, výchozí 30 FPS. Grafiku vložit nad něj. Výstup přijímá i zvuk, pokud ho původní VDO.Ninja zdroj vysílá. Náhled režiséra zůstává tichý (`noaudio`). V OBS lze zapnout „Ovládat zvuk přes OBS“ pro samostatný kanál ve směšovači; stejný zvuk nepřidávejte podruhé. Po aktualizaci obnovte Browser Source, aby načetl nové nastavení zvuku. Stávající uložené relace a URL fungují dál, včetně relací původně uložených s `noaudio`. Samostatný výstup v běžném prohlížeči používá video bez zvuku (`noaudio`), aby blokování automatického přehrávání zvuku nezastavilo i obraz. V OBS je podle přítomnosti `window.obsstudio` zachován příjem se zvukem; skutečné přehrání v OBS ověřte na živém zdroji. Server HERO zvuk nepřeposílá ani nemixuje, přijímá ho přímo výstupní VDO iframe spolu s videem.
4. URL režie uložit pro příští návrat. Obsahuje editovací klíč; kolegovi u OBS poslat pouze výstupní URL. Název stanoviště a nastavení se ukládají automaticky, nejde zatím o sdílenou knihovnu profilů.

Bez živé kamery je v režii vidět označená ukázka; OBS ukazuje černou. Ukázka není simulovaná živá kamera.

## Nasazení v tomto prostředí

Statické soubory v `public/virtual-camera`, samostatný handler `src/web/virtual-camera-handler.js`, API `/api/virtual-camera` přes existující Vercel funkci `game-summary` (nepřidává se třináctá funkce). Současný `DATABASE_URL` ukládá pouze nové oddělené tabulky `hero_camera_sessions` / `hero_camera_sessions_preview`. Vytvoří se automaticky při prvním použití stejně jako existující OBS kanály. Preview je oddělené od produkčních kamerových relací. Nevytváří se organizace ani záznamy zápasů a není potřeba nový HMS token.

Vercel nemá dlouhodobý lokální disk a řídicí proces nelze sdílet pamětí napříč instancemi. Tato verze proto synchronizuje malé JSON zprávy přes databázi: výstup čte stav po 250 ms od dokončení předchozí odpovědi, režie posílá sloučené změny nejvýše po 180 ms a samostatný heartbeat po 2 s. Praktické zpoždění závisí na databázi a síti, negarantuje se přesná současnost snímků obou příjmů. Při více editorech konflikt revizí obnoví poslední uložený stav, nepřepíše jej potichu. Pro dlouhý provoz více stadionů změřit frekvenci a náklady nebo přidat specializovaný kanál pro ovládání.

Každý klient přijímá vlastní původní VDO.Ninja video přes WebRTC. Výstupní URL není retransmitované / překódované video ze serveru HERO. Server přenáší jen nastavení a stav. Dva příjemci mohou zvýšit upload telefonu; výpadek videa na telefonu nemůže nahradit server HERO.

Iframe je cizího původu, takže V1 nečte jeho DOM video, pixely nebo srcObject; používá CSS ořez celého iframe, jehož poměr stran odpovídá doručenému videu. Poměr stran získává přes oficiální iframe API `getStats`, kontroluje origin i konkrétní okno odesílatele. Samostatná VDO konfigurace, portrétní zdroje, multi-view, korekce rybího oka ani AI tracking nejsou ve V1. `cleanoutput` omezuje VDO UI, ale nenahrazuje přejímku konkrétní verze v OBS.

## Spojení a záloha

Po 8 s bez heartbeat režie nebo bez čerstvých dat API přejde výstup na celý obraz; pokud WebRTC video stále funguje, pokračuje nezávisle. Po návratu režie se obnoví uložený výřez. Aktivní řídicí panel ponechte v popředí, aby prohlížeč neomezoval časovače. Zamknutí / uspání jeho počítače spustí stejnou zálohu.

Rozlišuje se načtení přijímače, WebRTC spojení a přírůstek dekódovaných snímků podle statistik. Statistiky se čtou po 2 s. Po 10 s bez postupu hlásí výstup odpojení; při 30 s bez postupu nebo nedokončeném prvním připojení znovu načte přijímač. Při opakovaném neúspěchu čeká až 60 s. Explicitní odpojení obnovuje po 10 s. Po obnovení zůstává uložený zdroj i výřez. Počet dekódovaných snímků sám nedokazuje viditelné přehrávání: při blokování autoplay může přibývat i u pozastaveného videa.

Výstup nemá UI; chybně sestavený nebo neplatný odkaz ukáže černou. V režii je vidět přítomnost a nahlášený stav výstupního klienta. „OBS / výstup“ může být i samostatná stránka v běžném prohlížeči, nikoli důkaz vysílání OBS. Pro ostrý provoz ponechte vlastní záložní OBS scénu s původním širokým VDO zdrojem a statickým obrazem pro výpadek telefonu.

## Přístup

Vytvoření nové prázdné relace je dostupné bez organizačního účtu; limit je 5 za minutu na IP a instanci (stejný prototypový model jako OBS kanály). Nepoužívá žádné HMS oprávnění. Náhodné klíče mají 192 bitů; ukládají se pouze SHA-256 hashe. Klíč výstupu je odvozen HMAC z klíče režie; samotný výstup nedokáže klíč režie odvodit. API používá Authorization, nikoli query s klíčem. URL stránky drží klíč ve fragmentu a posílá no-referrer. Výstupní klíč umožňuje číst zdrojovou VDO URL a její případné heslo, proto i tento odkaz sdílet jen s obsluhou. Není to DRM. V1 nemá správu uživatelů ani odvolávání jednotlivých klíčů.

## Ověření

`node --test test/virtual-camera.test.js` ověřuje oprávnění režie/výstupu, sanitizaci URL, ohraničení geometrie, konflikt verzí, heartbeat/fallback data, obnovení stavu novým handlerem a oddělení produkční/preview tabulky. `node --test` ověřuje regresi celé aplikace.

Před prvním přenosem společně ověřit skutečný Samsung → VDO.Ninja → OBS: shodu výřezu při 1×/2×/4× a v rozích, zpoždění, wide fallback po zavření režie, návrat po jejím otevření, výpadek a návrat telefonu, přístup druhého počítače, zvuk bez zdvojení a grafiku nad videem. Dokumentační a syntetické testy nejsou důkaz skutečného přehrávání konkrétního živého zdroje.

Reference: [VDO iframe API](https://docs.vdo.ninja/guides/iframe-api-documentation), [události spojení](https://docs.vdo.ninja/guides/iframe-api-documentation/iframe-api-basics), [cleanoutput](https://docs.vdo.ninja/advanced-settings/design-parameters/cleanoutput).

## Panorama a oprava OBS Output (12. 11. 2026)

Výstup má rám 16:9, v OBS nastavte 1920 × 1080. Náhled režie ukazuje celý doručený obraz, výběr je vždy 16:9 a zůstává uvnitř hranic. Pro 5120 × 1440 zabírá výřez při 1× polovinu šířky a celou výšku; lze jej přesouvat zcela doleva i doprava. Při ztrátě řízení je celé panorama zobrazeno s případnými černými pruhy. Staré relace bez metadat používají 16:9, dokud přijímač nezíská skutečné rozměry. Režie ukládá pouze poměr stran do stávající konfigurace, bez nové tabulky nebo změny klíčů.

Nativní rozlišení ZONEWAY 5120 × 1440 nezaručuje stejné rozlišení z OBS Virtual Camera a VDO.Ninja. Diagnostika uvádí doručené rozlišení. HERO požaduje `scale=100` a zachovává explicitní video bitrate, takže velikost náhledu zbytečně neomezuje kvalitu. Síť, encoder a nastavení zdrojového OBS mohou rozlišení dál omezovat. Je-li už v doručeném 16:9 videu panorama s vloženými pruhy nebo oříznuté, HERO nemůže z nativního rozlišení odvodit ztracené pixely; správný poměr musí dodat zdrojový OBS/VDO.

Příčina reprodukované černé stránky: samostatný výstup přijímal i audio a Chrome blokoval automatické přehrávání. V živém testu se video dekódovalo, ale zůstalo `paused=true`, `currentTime=0`. Opravený výstup se stejnou relací a samostatným tichým příjmem přehrával (`paused=false`, postup času přibližně 1 → 6 → 11 s). V testu bylo doručeno 960 × 540 (16:9), nikoli nativní panorama. Přístupové klíče ani zdrojová URL nebyly vypsány do diagnostiky.

Stavy čekání na video / připojeno / odpojeno / chyba se zobrazují v existující režii přes hlášení výstupního klienta. Ve výstupu jsou jen ve skrytém elementu a `body.dataset.mediaStatus`, bez overlaye v obrazu. Podporovány jsou i vstupní odkazy s `?id=…&key=…`, které se místně převedou na fragment; nové odkazy zůstávají ve fragmentu. Query odkazy mohou již při prvním načtení projít přístupovým logem hostingu, proto sdílejte pouze generovaný fragmentový odkaz.

Syntetický prohlížečový test `node scripts/virtual-camera-browser.mjs` (Playwright; volitelně PLAYWRIGHT_MODULE a CHROMIUM_PATH) ověřuje dva nezávislé přijímače, přehrávání video elementu, 1920 × 1080, pan/zoom 32:9, skrytou diagnostiku, kontrolu odesílatele a opakovaný reconnect. Nenahrazuje test ZONEWAY ani skutečného OBS Browser Source. Přímé řízení režie během živého testu nebylo přebíráno; pohyb a zoom jsou ověřeny synteticky. Skutečné OBS, jeho audio a výpadek stadionového zdroje zůstávají k přejímce.

Reference opravy: [VDO autoplay](https://docs.vdo.ninja/common-errors-and-known-issues/autoplay-doesnt-work-in-chrome-or-vmix-v77), [plná dostupná kvalita](https://docs.vdo.ninja/advanced-settings/video-parameters/scale).

## V2 / V3 — mimo V1

V2: asistované sledování označené oblasti hry s ručním převzetím, limity rychlosti pohybu a zoomu, kalibrace rybího oka, knihovna stanovišť. Nejprve vyřešit oprávněný přístup ke snímkům mimo cizí iframe a ověřit kvalitu zdroje.

V3: autonomní odhad oblasti hry a plánování záběru, měření kvality na reálných záznamech stadionů, při nízké jistotě široký obraz a okamžité ruční převzetí. Samotná detekce puku není záruka dobré režie. O případné mediální infrastruktuře rozhodnou výsledky; nejde o vlastnost současné výstupní stránky.

## Experimentální AUTO Cameraguy

Volitelné lokální rozšíření nyní přidává AUTO nad stávající renderer. Výchozí je MANUAL. Detekce hráčů, kalibrace, bezpečné oddálení, postup spuštění a výsledky všech sedmi klipů jsou v [HERO_AUTO_CAMERAGUY.md](HERO_AUTO_CAMERAGUY.md). Jde o experimentální odhad herní oblasti; předchozí plán V2/V3 neznamená, že je autonomní režie ověřená pro ostré vysílání.
