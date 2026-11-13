# HERO Auto Cameraguy V1 — experimentální rozšíření

Stav ověření: 13. listopadu 2026. Vývojová větev `codex/hero-auto-cameraguy`.
V1 je lokálně funkční experiment, nikoli ověřený autonomní kameraman pro ostré vysílání.
Produkce nebyla nasazena. Výchozí režim při každém otevření režie je MANUAL.

## Architektura a ovládání

Živý tok: VDO.Ninja iframe → požadavek `getSnapshotByStreamID` přibližně 2× za sekundu → JPEG → lokální Python služba na `127.0.0.1:8766` → YOLOX-Nano COCO person detector → Supervision ByteTrack → společný JS `AutoDirector` → existující stav X/Y/zoom a synchronizace relace → původní OBS renderer.

VDO.Ninja obraz zůstává v původním iframe; nevzniká druhý renderer. Snímky z iframe se přijímají jen z `https://vdo.ninja`, z aktuálního okna a se správným identifikátorem požadavku. Nelze číst DOM cizího iframe. Zpracovává se celý zdroj, včetně černých okrajů; přenos snímku se omezuje na šířku 1920 px. Detektor používá tři překrývající se části zmenšené na 416×416. Snímky neodcházejí na HERO server ani do externí AI služby.

Analytika vrací souřadnice, ID, stáří a rychlost stop, confidence a čas analýzy. `AutoDirector` vrací `targetX`, `targetZoom`, `confidence`, `trackingState`, `reason` a výsledný výřez. Upřednostňuje pohyb v lokální oblasti a krátkou predikci; vytrvalý rychlý předbíhající hráč může dostat přednost před skupinou. Krátce drží prostor u kalibrované branky. To jsou heuristiky, nikoli rozpoznané hokejové události. Puk se nedetekuje.

Poloha Y se v běžné výchozí kalibraci drží na 0,5. AUTO respektuje doručený poměr stran a geometrii 16:9 i u nativního panoramatu 32:9; při nejistotě používá nejširší výřez 1× této geometrie. Celé panorama s pruhy zobrazuje původní OBS záloha po ztrátě režie. Zachovány jsou aktuální opravy autoplay, metadat a reconnectu z hlavní větve. X má mrtvou zónu a rychlostní limit; zoom má samostatný limit. Ošetřeno je i oddalování u hranice obrazu, které by jinak vynutilo skok středu. Při nízké jistotě se krátce drží poslední spolehlivá oblast, po delší nejistotě se kamera vrací na široký záběr. Snímky starší než 1,2 s se ignorují. Původní bezpečnostní návrat OBS při ztrátě režie po 8 s zůstává zachovaný.

V režii jsou MANUAL/AUTO, citlivost, preferovaný zoom, confidence/stav/důvod, přímé ruční převzetí a volitelná diagnostika. Ruční posun, zoom, reset i klávesové zkratky automat zastaví. Převzetí nemění X/Y/zoom ani videozdroj. Při konfliktu verzí se AUTO zastaví. Diagnostika existuje jen v režii; OBS HTML ji neobsahuje.

Kalibrace je obdélník aktivní plochy, horizontální pozice branek a středu a vyloučený horizontální pás střídaček. Všechny hodnoty jsou 0–1 vzhledem k celému originálu. Ukládají se jako `autoSettings` do existující relace společně s názvem stanoviště. Nejde o geometrickou rektifikaci ani univerzální kalibraci stadionů. Výchozí hodnoty odpovídají dodaným klipům; na jiném stadionu je nutné je upravit.

## Instalace a spuštění

Použijte Python 3.12 a Node 20+. Příkazy spouštějte z kořene tohoto checkoutu. PowerShell:

```powershell
pnpm install --frozen-lockfile
./scripts/auto-camera/setup.ps1 -Python python
```

Parametr `-Python` může být plná cesta k Pythonu 3.12. Skript vytvoří oddělené `.auto-camera-venv`, instaluje pevné verze, stáhne oficiální model a ověří SHA256. Model ani prostředí se necommitují. Původní problém vznikl instalací supervision 0.31.7, která již neexportuje `sv.ByteTrack`. V1 vyžaduje `supervision==0.27.0`; skript i analyzátor dostupnost API ověřují a při chybě selžou s vysvětlením.

První terminál — služba:

```powershell
./.auto-camera-venv/Scripts/python.exe scripts/auto-camera/analyzer.py serve --model artifacts/auto-camera-models/yolox_nano.onnx
```

Druhý terminál — oddělená lokální režie s relacemi pouze v paměti, bez databáze a produkčních klíčů:

```powershell
node scripts/auto-camera/dev-server.mjs
```

Otevřete `http://127.0.0.1:3015/virtual-camera/`. Připojte živý zdroj, ověřte obraz a zapněte AUTO. Pro práci s dodaným souborem otevřete **Test záznamu**, vyberte MP4 a zapněte AUTO. Jsou dostupné pauza a posuv času; seek resetuje tracker. Soubor se nikam nenahrává. Lokální test je povolen jen na loopback hostu. OBS stále používá živý VDO.Ninja zdroj, proto tento test provádějte v oddělené lokální relaci vytvořené dev serverem. Tlačítkem **Obnovit video** se vrátíte k živému zdroji.

Služba je určena jednomu operátorovi/trackeru v jednom procesu. Váže se jen na loopback, vyžaduje přesný Host i povolený Origin, přijímá jen JPEG, má limit požadavku, časové limity a neřadí neomezenou frontu. Výchozí povolené originy jsou `http://localhost:3015` a `http://127.0.0.1:3015`. Pro jinou režii je potřeba explicitně přidat `--origin https://konkretni-host`. Prohlížeč může u HTTPS režie požadovat oprávnění k lokální síti; bez něj se AUTO bezpečně oddálí. CSP povoluje pouze konkrétní loopback službu, nikoli libovolné externí analytické servery. Živá HTTPS/VDO.Ninja cesta ještě vyžaduje praktické ověření s aktivním přenosem.

## Opakovatelná analýza všech videí

```powershell
./.auto-camera-venv/Scripts/python.exe scripts/auto-camera/analyzer.py analyze --model artifacts/auto-camera-models/yolox_nano.onnx --videos 'C:/PRAGUE HOCKEY MASTERS/2026-2027/deve/AI camera'
node scripts/auto-camera/evaluate.mjs
./.auto-camera-venv/Scripts/python.exe scripts/auto-camera/render.py
node --test
node scripts/build-media-client.js
```

Při běžící službě lze navíc spustit `node scripts/auto-camera/check-service.mjs` (po offline analýze, která vytvoří testovací JPEG). Výstupy jsou v ignorovaném `artifacts/auto-camera/`: inventář, detekce, trajektorie každého snímku, vyhodnocení, detekční a srovnávací kontaktní listy a sedm `NN.auto.mp4`. Render používá stejné JS rozhodování jako prohlížeč; výstupy jsou 960×540 / 25 FPS / H.264, bez diagnostické grafiky a bez zvuku. Původní panoramatické MP4 zůstávají beze změn. Detekce offline běží po šesti snímcích (25/6 = 4,17 Hz); živé snímkování má přibližně 2 Hz, takže nejde o přesně stejný časový průběh živé pipeline.

## Výsledky na dodaných záznamech

Všechny vstupy mají 1920×1080, 25 FPS a H.264. Celkem 217,92 s, kompletně dekódováno i vyrenderováno 5 448 snímků; analyzováno 911 vzorků. Výřez zůstává uvnitř zdroje. Všechny testovací vstupy jsou skutečně zakódované jako 16:9 s vloženými pruhy; test nativního 32:9 je geometrický, nikoli záznam ZONEWAY. Maximální horizontální rychlost ve výchozím nastavení byla 0,16 šířky zdroje/s, maximální změna zoomu 0,5×/s. Na testovacím počítači byla průměrná doba detektoru 49–56 ms/vzorek, P95 podle klipu 52–61 ms. Tyto časy nejsou měřením latence celé živé pipeline.

| ID / scénář (název zkrácen) | Délka | Snímky / vzorky | Průměr analýzy | Předběžná vizuální kontrola kontaktů |
| --- | ---: | ---: | ---: | --- |
| 01 Attack of yellow team… goal… celebration | 60,76 s | 1 519 / 254 | 49,3 ms | Zachytí oblast tlaku a později pravou část; při ztrátě vzdálených hráčů může přejít k rozhodčímu nebo se zpožďovat. Oslavu nerozpoznává. |
| 02 counter attack of red team… penalty box | 21,96 s | 549 / 92 | 49,7 ms | Přesouvá se mezi stranami a konzervativně oddaluje, ale někdy volí bližšího rozhodčího místo vzdálené akce. Návrat z trestné lavice nerozlišuje. |
| 03 Faceoff… pressure… save… change of lines | 45,08 s | 1 127 / 188 | 49,9 ms | Pravou oblast umí držet; v kontaktu kolem 22,56 s chybně přesouvá záběr vlevo k rozhodčímu. Zákrok ani střídání nejsou spolehlivě klasifikovány. |
| 04 gameplaye from one side to another | 36,16 s | 904 / 151 | 50,8 ms | Probíhají plynulé přesuny a oddálení. Některé okrajové hráče a rychlou změnu strany dohání pozdě. |
| 05 long pass… breakway and goal | 32,84 s | 821 / 137 | 51,2 ms | Umí měnit oblast, ale samostatný únik není spolehlivě odlišen. V tomto klipu ani jednou nevznikl stav BREAKAWAY_CANDIDATE. |
| 06 Pause and pregame | 6,76 s | 169 / 29 | 49,5 ms | Celý klip zůstává SAFE_WIDE bez pohybu a zoomování; vhodné konzervativní chování. |
| 07 Puck drop faceooff in center | 14,36 s | 359 / 60 | 56,2 ms | Drží centrální skupinu. Krátký kandidát úniku je falešný/nejistý; nejde o důkaz úspěšné detekce úniku. |

Kontaktů bylo vizuálně zkontrolováno osm na klip, nikoli každý snímek ručně. Nejsou k dispozici anotace polohy puku nebo správné oblasti hry. `activeTrackVisibility` v JSON je pouze podíl platných detekovaných stop uvnitř výřezu, **není přesnost sledování hry**. Plynulost, validita geometrie ani vysoká confidence nedokazují správnou volbu herní akce. Confidence je heuristické skóre, nikoli kalibrovaná pravděpodobnost.

Ověřeno 627/627 Node testů a build media klienta. Testy zahrnují původní role edit/read, konflikty, persistenci, heartbeat, geometrii, zdrojové audio a klávesové ovládání; nové testy pokrývají maskování, nejistotu, kandidáta aktivního útočníka, hranice kalibrace, rychlost a shodu CSP. Sedm HTTP kontrol služby ověřilo health/verzi supervision, odmítnutí cizího originu, preflight, typ vstupu, vadný JPEG a skutečnou analýzu snímku.

V prohlížeči byly ověřeny lokální video → skutečná služba → pohyb/zoom, MANUAL jako výchozí stav, ruční převzetí bez změny výřezu 2× (shodná geometrie před/po), přehrávání/pauza a bezpečný návrat na 1× po zastavení služby. Při funkční službě nebyly hlášeny chyby v konzoli. Ověření proběhlo i s CSP použitou v aplikaci. Skutečný živý přenos VDO.Ninja, skutečný OBS a chování HTTPS prohlížeče při povolení lokální sítě nebyly bez aktivního zdroje ověřeny.

## Licence a další kroky

YOLOX-Nano pochází z [oficiálního vydání YOLOX](https://github.com/Megvii-BaseDetection/YOLOX/releases/tag/0.1.1rc0), zdrojový projekt používá Apache-2.0. Supervision 0.27.0 používá MIT; texty jsou v `docs/auto-camera-licenses/`. Model má SHA256 `c789161ed43c8269fcd4e67c67eeeb4e80c622da2eb296a20bc6007bd18a0b7d`. Použit je obecný COCO model, nikoli nově natrénovaný hokejový model. Knihovny a FFmpeg mají vlastní licenční podmínky; setup je stahuje lokálně, jejich binární soubory se tímto PR nedistribuují. Dokumentace VDO.Ninja: [iframe API](https://docs.vdo.ninja/guides/iframe-api-documentation), [zdroj implementace snapshotů](https://github.com/steveseguin/vdo.ninja/blob/master/main.js).

Další kroky před ostrým AUTO: označit správnou oblast hry v testech, zlepšit detekci malých hráčů a odlišení rozhodčích, přidat případně polygonovou masku ledu a týmové role, ověřit skutečný samostatný únik i trestné střílení (samostatný klip trestného střílení nebyl dodán), ověřit VDO.Ninja/OBS a změřit celkovou latenci. Nová videa se automaticky nenatrénují; nynější pipeline se z nich sama neučí.
