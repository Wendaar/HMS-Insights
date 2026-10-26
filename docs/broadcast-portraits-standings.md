# Fotografie, TOP 5 týmu a aktuální tabulka

Změny jsou v testovacím PR #22, bez nasazení do produkce.

## Společný katalog partnerů a QR

Přehled `sponsors.html` i Studio čtou stejný organizační endpoint `catalog=sponsors`. Přehled je pouze čtecí pohled na HMS, nikoli další databáze ani samostatný editor. Zdrojové názvy, loga, claimy, weby a týmové vazby patří do HMS. Studio ukládá pouze reference na ID partnerů, povolení a pořadí pro vysílací kanál; malé a velké zobrazení sdílejí tento výběr. Odkazy na katalog jsou relativní, takže při nasazení na doménu produkce zůstanou na stejném hostiteli.

Vlastní knihovna je označena jako doplněk konkrétního kanálu, nikoli jako centrální katalog organizace. Ani položka s omezením na organizaci se tím nestává sdílenou mezi kanály.

Výchozí volba ve Studiu **Celá organizace** nabízí celý katalog aktuální organizace bez nutnosti týmových vazeb. Zaškrtávací seznam ukládá povolení a pořadí jako reference `hms-sponsor` s rozsahem `game` pro daný zápas a kanál. **Vybraný tým** zachovává dosavadní týmový filtr a oddělené reference `team`. Vypnutý seznam se nezmění automaticky na všechny partnery. Položka **Střídat všechny odpovídající** rotuje povolené položky; výběr konkrétního jména zobrazí jen tuto povolenou položku. Oba partnerské formáty sdílejí výběr. Starší OBS adresy bez `partnerScope` zachovávají týmový výklad.

Navržené budoucí centrální ukládání QR: soubor partnera s rolí QR přiřadit ke skutečnému sponzorovi; obecnou výzvu na sociální sítě, rozcestník nebo kanál přiřadit k organizaci, případně omezit na tým či zápas. Obecná výzva se nemá vydávat za sponzora. Tato část čeká na podporu souborů a jejich rolí v HMS API. Do té doby funguje ruční přidání hotového QR pro kanál; běžné logo se nikdy automaticky nepovažuje za QR.

## Fotografie a týmová identita

- Soupiska ukazuje fotografii každého hráče, pokud ji HMS má, a výraznější týmové logo. Jednotýmová stránka skládá až 20 hráčů do dvou sloupců, aby portréty zůstaly čitelné. Dvoutýmový přehled zachovává 12 hráčů na tým a stránku. Ovladač a OBS mají stejné stránkování.
- Vícebodový výkon/hattrick má portrét hráče a týmové logo přímo u jména.
- Přehled gólů používá ověřenou fotografii střelce a týmové logo u každého gólu. Asistence zůstávají textově uvedené.
- Fotografie z veřejného detailu se přijmou pouze po shodě obou týmů a data s autentizovaným zápasem a shodě ID hráče i týmu. Cizí zápas, jiné týmové přiřazení, smazaná položka a nebezpečná URL fotografii dodat nemohou. Při chybějící fotce se nevytváří smyšlený obličej.

## TOP 5 týmu · sloupec

Vybrat novou vrstvu, domácí nebo hostující tým, statistiku Body / Góly / Asistence a roh obrazu. Panel se při zobrazení vysune ze strany, respektuje systémové omezení animací a má fotografie, jména, hodnoty a týmové logo.

Data čte z oficiálního HMS `public/playersStats`: nejprve `groupId`, pokud je známé z autentizovaného zápasu; jinak přesně určené `phaseIds`. Patřičný rozsah Skupina / Fáze je uvedený ve vrstvě společně se soutěží, sezonou a názvem skupiny/fáze. Jde o aktuální statistiky při načtení, ne historický stav ke dni vybraného starého zápasu. Tým se filtruje pomocí UUID, ne podle podobnosti názvů.

Původní větší přehled Lídři týmu umí použít stejná aktuální data. Starší uložené statistiky historie zůstávají v kontextu pro PP/PK a výsledky; nová aktuální vrstva se za kompletní statistiky nevydává, pokud oficiální zdroj není dostupný.

## Aktuální tabulka

Výchozí režim **Oba soupeři · skutečné pořadí** ukáže dvě mužstva z načteného zápasu a jejich pozice v celé tabulce. Pokud jsou například na 3. a 12. místě, zobrazí 3. a 12., s oddělovačem vynechaných míst. Nikdy nepřečísluje výřez na 1. a 2. Body a odehraná utkání se přebírají ze stejné tabulky, doplňují je loga.

Režim **Celá tabulka · po stránkách** ukazuje osm týmů na stránku a zachovává původní pozice i na dalších stránkách. Pokud jeden ze soupeřů v dané tabulce chybí, nevymýšlí jeho pořadí ani nulové body a tuto skutečnost označí.

Oficiální zdroj `public/standings?phaseId=…` (případně `groupId=…`) je stejný jako u veřejného HMS widgetu tabulek. Celé pořadí řádků API se zachová včetně shody bodů; nejprve se přidělí pozice celé tabulce a až poté filtrují soupeři. Z neúplného archivu našich importů se tabulka nepočítá a nevymýšlí se bodovací ani rozřazovací pravidla.

## Ovládání a dostupnost

Nové volby používají dosavadní stálý OBS kanál, včetně Zobrazit / Skrýt. Výstup je čistý 1920 × 1080, bez ovládacích prvků, se stejným přizpůsobením menšímu OBS rozlišení jako ostatní vrstvy. Aktuální statistiky se obnovují nejvýše po minutě, s krátkou serverovou cache a nezávislou dostupností tabulky a hráčských statistik.

Galerie `demo.html` obsahuje označené smyšlené příklady nových formátů, včetně modelových pozic 3. a 12. Nové skutečné čtení je dostupné přes `/api/broadcast?org=PHM&gameId=…&league=1`; identita a rozsah pocházejí z autentizovaného zápasu. Žádný organizační API klíč se nepředává veřejnému statistickému endpointu ani do prohlížeče.
