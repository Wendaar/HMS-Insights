# Broadcast V2 — výsledky ověření

Aktualizace po uživatelském feedbacku: **659/659** regresních testů. Rozšířené browser scénáře ověřují příští zápasy a výsledky v PRE-GAME / IN-GAME / BREAK / POST, shodu READY s již hydratovaným náhledem bez opakovaných context requestů, sponzory nad velkou grafikou, změnu rohu až po SHOW, volitelné skrytí při kolizi a pořadí gólů po sloupcích. Záměrně zpožděný context nesmí blokovat TOP 5 ani sponzory. Původní výsledky níže zachycují první implementaci; pravidlo překrývání bylo podle feedbacku změněno na výchozí sponzory nad MAIN.

27. 11. 2026 ověřeno i skutečné utkání PHM `F62DABC4-98CA-11F1-8BDF-EF2495D048F3` (Fanklub Lev Praha – Voholto Karlín): veřejná data obsahovala 19 gólů, pět předchozích výsledků domácích a jeden příští zápas. Po načtení kontextu byl preview osmi kombinací sekce/grafika připraven za **33–47 ms**, pouze s jedním context requestem za celé přepínání. První ověřovací pokus odhalil 18s čekání na externí exportní knihovnu; po přesunu html2canvas na explicitní stažení miniatury tento blok zmizel. Nejde o měření studeného HMS API nebo výkonu OBS. Jednotlivě zvolený GNB Chem se objevil bez nutnosti zařazení do rotačního checklistu. Skutečný přehled gólů byl geometricky i vizuálně ověřen: 16 na první straně, čtení dolů levým a potom pravým sloupcem, bez překrytí footeru. Zbývající tři mají ruční druhou stránku. Artefakty `feedback-browser-results.json`, `feedback-announcement.png` a `feedback-scoring-real.png` v lokálním `artifacts/broadcast-v2/`.

Datum: 26. 11. 2026. Izolovaná větev `codex/broadcast-studio-v2`, základ `95e7b43`. Žádné nasazení, žádný zápis do produkčního kanálu ani HMS.

- `pnpm install --frozen-lockfile`: úspěšně, bez změny lockfile.
- `node --test`: **656 prošlo, 0 selhalo** (včetně pěti nových V2 testů).
- `node scripts/broadcast-director-browser.mjs`: **12 akceptačních scénářů prošlo**, Playwright + instalovaný Microsoft Edge, 1440×1000 a OBS 1920×1080. Rozložení dále kontrolováno v 1280×800, 1920×1080 a 390×844. Použit in-memory channel store a označená testovací data; žádné připojení k Neon/HMS.
- Kontrola syntaxe nových controller/compositor modulů a `git diff --check`: bez chyb.

| Scénář zadání | Ověřený výsledek |
| --- | --- |
| 1. Výběr zápasu | Organizace a zápas z katalogu, po výběru zavřený dialog. Přímé otevření `?game=` po reloadu. |
| 2. PREVIEW / LIVE | TOP 5 Points připraven bez změny serverové revize; změna metriky neovlivnila živé Points před SHOW. Náhled viditelný bez scrollu. |
| 3. MAIN | SHOW vytvořilo MAIN, HIDE MAIN jej odstranilo a ponechalo partnery. |
| 4. SPONSORS | Dvě reálné identifikátorové reference testovacího katalogu se střídají; MAIN a SPONSORS současně, při změně metriky oba existující rámce zachovány a začátek rotace nezměněn. Plná grafika partnery pouze překryje, HIDE MAIN je odkryje. |
| 5. HIDE ALL | Obě vrstvy skryty, stav zůstal skrytý po obnovení dat i reloadu OBS. Opožděné starší SHOW odmítnuto. Příkaz fungoval i při simulované chybě lokálního úložiště. |
| 6. Soupiska | 20 hráčů jednoho týmu bez stránky, mimo footer; dále 24 jednoho týmu a 20+20 na jedné ploše, konzervativní stránky při mimořádně dlouhých jménech. |
| 7. Góly | Sedm gólů v jedné mřížce bez stránky a překrytí; dále 12 událostí a extrémně dlouhé údaje s omezenou kapacitou stránky. |
| 8. Bez událostí | Nulový počet ověřených gólů → WAITING FOR DATA. Neověřené události → UNAVAILABLE v unit testu. QR bez doplňku se netváří jako READY. |
| 9. Fotografie | V2 nemá globální panel fotografie. Žádný náhodně předvybraný hráč; Small Insight potřebuje výběr výkonu. |
| 10. Kompatibilita | Stará validace kanálů a přímých URL zůstává v regresní sadě. V2 používá jednu stabilní URL. Same-game SHOW změnilo obsah bez navigace MAIN; partner zůstal stejný iframe. |
| 11. Organizace / jazyk | Změna EUCHL → PHM ponechala PROGRAM EUCHL do SHOW, po SHOW bylo PHM a původní partner vypnutý. Změna UI jazyka se nepublikovala před SHOW. |
| 12. HMS chyba | Simulované HTTP 503: HIDE ALL fungoval, chyba se zobrazila v ovládání, reload nezačal vysílat starý obsah. |

V jednom úplném rozšířeném průchodu bylo zaznamenáno: 43 čtení kanálu, 12 zápisových příkazů, 11 základních čtení zápasu, 7 požadavků league, 5 context, 6 katalogů a 6 navigací vnořených rámců. Počty zahrnují přípravu, reloady, screenshoty, přepnutí organizace a samostatnou kontrolu layoutů. Nejde o benchmark skutečného HMS, CPU OBS ani YouTube. Podstatná ověřená vlastnost: změna metriky nezpůsobila navigaci existujících MAIN/SPONSORS rámců.

Lokální artefakty: `artifacts/broadcast-v2/browser-results.json`, `director.png`, `lineup.png`, `scoring-summary.png`, `control-1280.png`, `control-1920.png`, `control-390.png`. Jde o testovací obsah, nikoli produkční statistiky.

Zbývá před produkčním schválením: kontrola skutečných aktuálních PHM/EUCHL zápasů a partnerů na chráněném preview, reálný OBS Browser Source a výpadek jeho sítě, fyzická čitelnost ve výsledném 720p/1080p přenosu, delší provoz a upstream cache/CPU měření. Produkční stránku nebylo možné webovým nástrojem načíst; neprohlašujeme proto živé nasazení nebo kompletní produkční end-to-end ověření. Připravované grafiky a rollback jsou uvedeny v [BROADCAST-V2.md](BROADCAST-V2.md).
