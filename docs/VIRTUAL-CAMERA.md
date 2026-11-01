# HERO Virtual Camera V1

Otevřete `/virtual-camera` (také karta v Control Center → Media). Neinstaluje se plugin do OBS. Režisér dostane webové ovládání, OBS vlastní webovou stránku jako Browser Source, 1920 × 1080. Grafika a skóre zůstávají samostatnými zdroji nad kamerou. Žádné Game ID, organizace ani HMS API nejsou potřeba.

## První použití

1. Otevřít `/virtual-camera`, vložit přijímací `https://vdo.ninja/?view=…` pro jedinou kameru a kliknout Připojit kameru. Použijte Samsung na šířku, ideálně 16:9.
2. Myší / šipkami posouvat výřez, W přiblížit, S oddálit, R reset; Shift jemně. Fungují malá i velká písmena a také +/− včetně numerické klávesnice. Předvolby 1×, 1.5×, 2×, 3×; slider až 4×. Volitelné vyhlazení 250 ms. Při psaní do polí se kamerové zkratky nespouštějí.
3. Zkopírovat nabídnutý výstupní odkaz do OBS → Zdroj Prohlížeč, 1920 × 1080, výchozí 30 FPS. Grafiku vložit nad něj. Výstup přijímá i zvuk, pokud ho původní VDO.Ninja zdroj vysílá. Náhled režiséra zůstává tichý (`noaudio`). V OBS lze zapnout „Ovládat zvuk přes OBS“ pro samostatný kanál ve směšovači; stejný zvuk nepřidávejte podruhé. Po aktualizaci obnovte Browser Source, aby načetl nové nastavení zvuku. Stávající uložené relace a URL fungují dál, včetně relací původně uložených s `noaudio`. V běžném prohlížeči může automatický zvuk omezovat politika autoplay; skutečné přehrání v OBS ověřte na živém zdroji. Server HERO zvuk nepřeposílá ani nemixuje, přijímá ho přímo výstupní VDO iframe spolu s videem.
4. URL režie uložit pro příští návrat. Obsahuje editovací klíč; kolegovi u OBS poslat pouze výstupní URL. Název stanoviště a nastavení se ukládají automaticky, nejde zatím o sdílenou knihovnu profilů.

Bez živé kamery je v režii vidět označená ukázka; OBS ukazuje černou. Ukázka není simulovaná živá kamera.

## Nasazení v tomto prostředí

Statické soubory v `public/virtual-camera`, samostatný handler `src/web/virtual-camera-handler.js`, API `/api/virtual-camera` přes existující Vercel funkci `game-summary` (nepřidává se třináctá funkce). Současný `DATABASE_URL` ukládá pouze nové oddělené tabulky `hero_camera_sessions` / `hero_camera_sessions_preview`. Vytvoří se automaticky při prvním použití stejně jako existující OBS kanály. Preview je oddělené od produkčních kamerových relací. Nevytváří se organizace ani záznamy zápasů a není potřeba nový HMS token.

Vercel nemá dlouhodobý lokální disk a řídicí proces nelze sdílet pamětí napříč instancemi. Tato verze proto synchronizuje malé JSON zprávy přes databázi: výstup čte stav po 250 ms od dokončení předchozí odpovědi, režie posílá sloučené změny nejvýše po 180 ms a samostatný heartbeat po 2 s. Praktické zpoždění závisí na databázi a síti, negarantuje se přesná současnost snímků obou příjmů. Při více editorech konflikt revizí obnoví poslední uložený stav, nepřepíše jej potichu. Pro dlouhý provoz více stadionů změřit frekvenci a náklady nebo přidat specializovaný kanál pro ovládání.

Každý klient přijímá vlastní původní VDO.Ninja video přes WebRTC. Výstupní URL není retransmitované / překódované video ze serveru HERO. Server přenáší jen nastavení a stav. Dva příjemci mohou zvýšit upload telefonu; výpadek videa na telefonu nemůže nahradit server HERO.

Iframe je cizího původu, takže V1 nečte jeho DOM video, pixely nebo srcObject; používá CSS ořez a scale celého 16:9 iframe. Samostatná VDO konfigurace, portrétní zdroje, multi-view, korekce rybího oka ani AI tracking nejsou ve V1. `cleanoutput` omezuje VDO UI, ale nenahrazuje přejímku konkrétní verze v OBS.

## Spojení a záloha

Po 8 s bez heartbeat režie nebo bez čerstvých dat API přejde výstup na celý obraz; pokud WebRTC video stále funguje, pokračuje nezávisle. Po návratu režie se obnoví uložený výřez. Aktivní řídicí panel ponechte v popředí, aby prohlížeč neomezoval časovače. Zamknutí / uspání jeho počítače spustí stejnou zálohu.

Rozlišuje se načtení stránky VDO a událost WebRTC spojení. Ani potvrzení spojení nezaručuje dekódování nových snímků; zamrzlé video není ve V1 automaticky spolehlivě rozpoznatelné. Obnovit video načte znovu místní přijímač; OBS má vlastní obnovení Browser Source. Po explicitním odpojení se iframe automaticky jednou obnoví po 10 s; další obnovu řeší VDO.Ninja.

Výstup nemá UI; chybně sestavený nebo neplatný odkaz ukáže černou. V režii je vidět přítomnost a nahlášený stav výstupního klienta. „OBS / výstup“ může být i samostatná stránka v běžném prohlížeči, nikoli důkaz vysílání OBS. Pro ostrý provoz ponechte vlastní záložní OBS scénu s původním širokým VDO zdrojem a statickým obrazem pro výpadek telefonu.

## Přístup

Vytvoření nové prázdné relace je dostupné bez organizačního účtu; limit je 5 za minutu na IP a instanci (stejný prototypový model jako OBS kanály). Nepoužívá žádné HMS oprávnění. Náhodné klíče mají 192 bitů; ukládají se pouze SHA-256 hashe. Klíč výstupu je odvozen HMAC z klíče režie; samotný výstup nedokáže klíč režie odvodit. API používá Authorization, nikoli query s klíčem. URL stránky drží klíč ve fragmentu a posílá no-referrer. Výstupní klíč umožňuje číst zdrojovou VDO URL a její případné heslo, proto i tento odkaz sdílet jen s obsluhou. Není to DRM. V1 nemá správu uživatelů ani odvolávání jednotlivých klíčů.

## Ověření

`node --test test/virtual-camera.test.js` ověřuje oprávnění režie/výstupu, sanitizaci URL, ohraničení geometrie, konflikt verzí, heartbeat/fallback data, obnovení stavu novým handlerem a oddělení produkční/preview tabulky. `node --test` ověřuje regresi celé aplikace.

Před prvním přenosem společně ověřit skutečný Samsung → VDO.Ninja → OBS: shodu výřezu při 1×/2×/4× a v rozích, zpoždění, wide fallback po zavření režie, návrat po jejím otevření, výpadek a návrat telefonu, přístup druhého počítače, zvuk bez zdvojení a grafiku nad videem. Dokumentační a syntetické testy nejsou důkaz skutečného přehrávání konkrétního živého zdroje.

Reference: [VDO iframe API](https://docs.vdo.ninja/guides/iframe-api-documentation), [události spojení](https://docs.vdo.ninja/guides/iframe-api-documentation/iframe-api-basics), [cleanoutput](https://docs.vdo.ninja/advanced-settings/design-parameters/cleanoutput).

## V2 / V3 — mimo V1

V2: asistované sledování označené oblasti hry s ručním převzetím, limity rychlosti pohybu a zoomu, kalibrace rybího oka, knihovna stanovišť. Nejprve vyřešit oprávněný přístup ke snímkům mimo cizí iframe a ověřit kvalitu zdroje.

V3: autonomní odhad oblasti hry a plánování záběru, měření kvality na reálných záznamech stadionů, při nízké jistotě široký obraz a okamžité ruční převzetí. Samotná detekce puku není záruka dobré režie. O případné mediální infrastruktuře rozhodnou výsledky; nejde o vlastnost současné výstupní stránky.
