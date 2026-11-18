# HERO Auto Cameraguy — srovnání sledování hry

Ověřeno 13. listopadu 2026. Srovnávací základ je commit `a692b16`, uložený před úpravami do ignorovaného `artifacts/auto-camera-baseline-a692b16`. Nové výsledky jsou v `artifacts/auto-camera-v2`; označení složky neznamená novou samostatnou aplikaci. Produkce ani hlavní větev nebyly změněny.

## Co se změnilo

- Výchozí detektor je YOLOX-Tiny; Nano zůstává volitelný. Model má stejný vstup 416×416, původ a licenci jako dosavadní detektor, vyšší nároky na CPU. Tiny SHA256: `427cc366d34e27ff7a03e2899b5e3671425c262ea2291f88bb942bc1cc70b0f7`. [Oficiální modely a download](https://github.com/Megvii-BaseDetection/YOLOX/blob/main/demo/ONNXRuntime/README.md).
- Z obrazu trupu se odhaduje opakovaný svislý kontrast světlých/tmavých pruhů a podíl barevných pixelů. Výsledek se časově vyhlazuje. Silný kandidát rozhodčího není cílem řízení; slabší důkaz snižuje jeho váhu. Pouhý černý/bílý nebo nerozlišený dres se nevylučuje. Není to natrénovaný klasifikátor rolí. V režii lze filtr vypnout, například u pruhovaných týmových dresů.
- Kandidát úniku se hledá v obou směrech, včetně směru opačného proti většině. Vyžaduje skutečný posun v historii a více různých snímků. Jediný opakovaný snímek nebo jednorázový skok kandidáta nepotvrdí. U dobře barevně podloženého rychlého hráče stačí i jediný viditelný hráč za ním.
- Krátké podržení ID, predikce a širší výřez u rychlého hráče chrání před krátkým výpadkem detekce. Protiútok ruší předchozí podržení branky. Výchozí limit pohybu je 0,16 šířky zdroje/s, pro potvrzený rychlý pohyb 0,264/s; zoom zůstává omezený na 0,5×/s při oddalování a 0,25×/s při přibližování.
- Pohyb barevného dresu doplňuje jen prostor před již potvrzeným neuronově detekovaným rychlým hráčem. Návrhy musí přetrvat několik pozorování; samy nesmějí řídit kameru, zvyšovat počet hráčů za útočníkem ani potvrdit únik. Maximální dodatečný předstih je 0,08 šířky zdroje a pouze v lokálním koridoru. Při rozsáhlém pohybu obrazu se tato pomoc vynechá. Je určena pevné panoramatické kameře a lze ji vypnout `--no-colour-motion`.

## Metoda porovnání

Všech sedm původních MP4 bylo znovu kompletně dekódováno a analyzováno. Celkem 217,92 s, 5 448 snímků, 911 analytických vzorků. Z nové trajektorie vzniklo sedm plných 960×540 / 25 FPS / H.264 ukázek a sedm srovnávacích kontaktních listů. Vstupy zůstaly beze změny. Každý řádek listu má **originál / předtím / nyní**; v originálu je původní výřez červený a nový žlutý. Vizuálně zkontrolováno osm rovnoměrných kontaktů na klip a přehled původních scén, nikoli ručně každý snímek.

Obě trajektorie se měří proti **stejným novým pozorováním**, nikoli každá proti vlastní populaci detekcí. Barevné pohybové návrhy jsou z metrik úplně vyloučené. Pomocná metrika „přitažení k rozhodčímu“ počítá vzorky, kde je cíl horizontálně alespoň o 0,04 šířky blíže kandidátu rozhodčího než nejbližšímu barevně podloženému hráči. Vyhodnocuje se jen při současné přítomnosti obou typů: 93 vzorků. Označení rolí zde pochází z heuristiky nové verze, ne z nezávislých lidských anotací; tato metrika může chybu klasifikace přehlédnout nebo započítat chybně.

„Viditelnost hráčů“ je podíl stejných 1 696 barevně podložených neuronových pozorování uvnitř skutečného výřezu. Jde o pokrytí viditelných detekcí, nikoli správnost volby hry/puku. Širší výřez tuto metriku zlepšuje i bez lepšího odhadu; proto je uveden také průměrný zoom. Neexistuje ručně označená správná poloha puku/akce. Čas v režimu BREAKAWAY není přesnost rozpoznání úniku.

## Výsledky všech sedmi videí

V každé buňce je původní → nová hodnota.

| ID / scénář | Přitažení k rozhodčímu (vzorky) | Viditelnost detekovaných hráčů | Průměrný zoom | Čas režimu rychlého hráče |
| --- | ---: | ---: | ---: | ---: |
| 01 Žlutí: tlak, gól, oslava | 16 → 0 | 89,7 → 98,0 % | 1,58 → 1,55× | 0 → 9,36 s |
| 02 Protiútok červených, návrat z trestné | 4 → 1 | 77,2 → 74,6 % | 1,53 → 1,53× | 0 → 0 s |
| 03 Vhazování, tlak, zákrok a střídání | 10 → 2 | 96,7 → 97,3 % | 1,62 → 1,63× | 0 → 0 s |
| 04 Přesuny ze strany na stranu | 1 → 0 | 88,7 → 85,0 % | 1,50 → 1,44× | 0 → 0,96 s |
| 05 Dlouhá přihrávka, únik a gól | 3 → 0 | 67,4 → 78,3 % | 1,65 → 1,57× | 0 → 5,00 s |
| 06 Přestávka / před zápasem | 0 → 0 | 100 → 100 % | 1,00 → 1,00× | 0 → 0 s |
| 07 Vhazování na středu | 0 → 0 | 100 → 100 % | 1,67 → 1,65× | 0,32 → 1,16 s |

Celkem pomocné přitažení k rozhodčímu **34 → 3 vzorky**; pokrytí stejných neuronových pozorování **87,1 → 90,9 %**. U klipů 02 a 04 pokrytí kleslo o 2,6 a 3,8 procentního bodu. Nelze proto tvrdit, že je každá metrika každého klipu lepší. Ani 1,16 s kandidáta u vhazování není důkaz správně rozpoznaného samostatného úniku.

Konkrétní vizuální pozorování:

- **02 / 11,00 s:** nový výřez je více vlevo u vzdálených hráčů, původní má větší prostor kolem bližšího rozhodčího. Celý klip však stále obsahuje ztráty malých hráčů a horší celkové pokrytí.
- **03 / 22,56 s:** původní záběr odešel vlevo k rozhodčímu. Nový drží širší oblast více vpravo, ale krajní hráč na pravé straně může být stále částečně oříznutý. Jde o zlepšení kontextu, nikoli úplné vyřešení situace.
- **05 / 28,76 s:** nový výřez přidává prostor před rychlým přesunem a u pravé branky. V klíčové části může být vybraným neuronovým ID stále červený dobíhající hráč, nikoli žlutý držitel puku; rozšířený koridor zahrnuje více akce před ním. Kamera tedy lépe zachytí prostor protiútoku, ale **držení puku a správný nositel stále nejsou spolehlivě určeny**.
- **06:** celý klip zůstává beze změny v širokém záběru. Samostatné barevné pohybové návrhy nesmějí vyvolat zoom nebo honění neexistujícího úniku.

Nová analýza trvala v průměru **179–222 ms/vzorek**, P95 podle klipu **203–299 ms**. Původní Nano měl 49–56 ms/vzorek. Vyšší cena zahrnuje Tiny, odhad dresů a pohybovou pomoc; nejde o izolovaný benchmark modelů ani měření latence celé pipeline. Živá režie vzorkuje přibližně 2 Hz, offline test 4,17 Hz. Chování 2Hz JPEG příjmu může být méně stabilní než offline z originálu. Nové nastavení je stále experimentální.

## Ověření a opakování

Prošlo 632/632 Node testů, 7/7 Python testů odhadu dresů a pohybové pomoci, sedm HTTP kontrol služby a media build. Regrese zahrnují pohybujícího se rozhodčího, samotné rozhodčí, povolení filtru, nebarevné dresy, útočníka proti většinovému směru, jediného viditelného pronásledovatele, opakovaný snímek, uvolnění podržení branky, nemožnost řízení samotnými barevnými návrhy a dosavadní geometrii/ruční režim. U všech sedmi MP4 byl při renderu ověřen počet snímků i 960×540 rozměr.

V prohlížeči ověřeno zapnutí/vypnutí a uložení filtru po obnovení stránky, skutečná nová analytická služba na lokálním záznamu, diagnostika bez chyb v konzoli a ruční převzetí. Spolehlivé označení rozhodčího na každém snímku tím ověřené není. Živý VDO.Ninja zdroj ani skutečné OBS nebyly převzaty nebo upraveny.

```powershell
# Nejprve uchovat/regenerovat původní výstupy pomocí revize a692b16 a Nano.
# V aktuální revizi (instalace podle HERO_AUTO_CAMERAGUY.md):
./.auto-camera-venv/Scripts/python.exe scripts/auto-camera/analyzer.py analyze --model artifacts/auto-camera-models/yolox_tiny.onnx --videos 'C:/PRAGUE HOCKEY MASTERS/2026-2027/deve/AI camera' --out artifacts/auto-camera-v2
node scripts/auto-camera/evaluate.mjs artifacts/auto-camera-v2
node scripts/auto-camera/compare.mjs artifacts/auto-camera-baseline-a692b16 artifacts/auto-camera-v2
./.auto-camera-venv/Scripts/python.exe scripts/auto-camera/validate.py --out artifacts/auto-camera-v2 --baseline artifacts/auto-camera-baseline-a692b16
node --test
# Při běžící službě a vypnutém AUTO prohlížeče:
node scripts/auto-camera/check-service.mjs artifacts/auto-camera-v2
```

Původní i nové video/JSON výstupy jsou lokální ignorované artefakty, nikoli obsah PR. V čistém klonu je pro srovnání nutné původní výstupy nejprve znovu vygenerovat. Bez srovnávací složky lze běžně vyrenderovat nové ukázky pomocí `render.py --out artifacts/auto-camera-v2`. Další nutné ověření: ručně anotované situace s nositelem puku a rozhodčími, jiné dresy/stadiony a skutečný živý VDO/OBS tok. Ze sedmi klipů nelze odvozovat obecnou přesnost.
