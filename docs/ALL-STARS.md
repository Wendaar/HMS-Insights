# All Stars of Month · Beta

Správa: `/control/apps/all-stars?org=phm&lang=cs` (také EUCHL, CS/EN).
Veřejný seznam: `https://app.phmcup.cz/all-stars/phm`.
Publikovaná sestava: `https://app.phmcup.cz/all-stars/<organizace>/<pojmenovana-sestava>`.
Odkaz a iframe se zobrazí po publikaci. Nevytváříme smyšlenou první sestavu.

## Pravidla a původní aplikace

Původní [generátor](https://wendaar.github.io/PHM-All-Stars-generator/)
zůstává beze změny: historické sestavy, schválená výjimka září 2026 včetně čtyř
říjnových zápasů, XLSX, PNG, JSON a samostatný HTML/iframe export.
Zdroj: `Wendaar/PHM-All-Stars-generator`, `domain.js`, `README.md`.

Uživatel pro nové API výběry potvrdil kalendářní měsíce a ruční finální šestici:
3 útočníci, 2 obránci, 1 brankář. Zářijová výjimka se nepřenáší do nových dat.
Nejdříve se řadí účast ve více než polovině zápasů týmu, pak skóre.
Původní hráčské skóre: 6× P/GP + 3× účast + 0,6× min(hvězdy,3) − 0,03× PIM.
Původní brankářské skóre: 100× SV ratio + 8× účast + 2× SO + min(hvězdy,3) − 2× GA/GP.

Společné importované snapshoty neobsahují hvězdy ani ověřené SO. Beta používá
výslovně označené **předběžné skóre** bez těchto členů; nejde o ekvivalent
původního plného skóre. Tyto chybějící metriky nejsou vydávány za nuly. Oficiální
hvězdy existují v doplňkovém veřejném HMS game API (využívá Game Report), ale
zatím nejsou součástí společného měsíčního snapshotu. Jejich ukládání a zpětné
doplnění je navazující práce. Brankář bez ověřených přiřazených gólů/zákroků nemá
skóre a vyžaduje ruční posouzení. GP vychází z importovaných zápasových řádků;
není to ověření odehraného času. Hráč × tým se nikdy nesčítá přes různé týmy.

Starší snapshoty neobsahují F/D. Hráči bez pozice jsou označeni a nabídnuti
v obou rolích; stejnou nominaci nelze vybrat dvakrát. Nové importy ukládají
rozpoznanou pozici ze zápasové sestavy. Obránci mají stejné skóre jako útočníci;
obranné metriky se nepředstírají. Týmový/ dlouhodobý kontext není v hodnocení.

## Datový a publikační kontrakt

`/api/all-stars` sdílí existující serverless funkci `api/game-summary.js`.
Katalog soutěží/sezon pochází z `controlContextCatalog` a je svázán s organizací.
Měsíční statistiky se načítají parametrizovaným SQL z existujících tabulek
`games`, `player_game_stats`, `goalie_game_stats`, `team_game_stats`.
Každý den měsíce se zkontroluje veřejným HMS rozpisem přes společný
`readPublicGameDay`, nejvýše tři souběžné dotazy, timeout a sdílený cache/cooldown.
Měsíční dotaz má limit 500 importovaných zápasů; větší výběr selže explicitně.

Dokončený zápas chybějící v DB se ukáže v seznamu chybějících importů. Zápas
se nesouladem událostí a výsledku nebo aktuálním rozpisem se nepoužije.
Historické importy před zavedením event snapshotů se ověřují shodou uložených
hráčských gólů obou týmů s aktuálním oficiálním výsledkem HMS. Tento odlišný
základ ověření je uveden v pokrytí (`verifiedByTotals`); časová osa se nepředstírá.
Brankářské zákroky těchto importů se navíc srovnávají s aktuálním týmovým
součtem zákroků HMS. Při nesouladu nemá brankář pořadí. Přítomný, ale rozporný
event snapshot nikdy nepoužije historickou výjimku.
Publikace vyžaduje uzavřený kalendářní měsíc, úplné pokrytí zvolené divize,
3+2+1 a výběr ověřený proti právě načteným kandidátům. Výpadek API není prázdný
úspěšný výsledek. Chybějící importy doplní stávající nástroj Historický import;
All Stars samo nespouští importy ani nezapisuje do HMS.

Přístup používá stávající organizační `HMS_<ORG>_TOOLS_ADMIN_SECRET`, případně
jeho existující webhook secret. Chybějící přístup nebo DB se uvádí pravdivě.
Kód zůstává pouze v paměti stránky, neposílá se ve veřejné adrese ani v exportu.
Organizace, volba jazyka či localStorage nejsou oprávnění.
Centrální konfigurace využívá existující `hms_tool_instances` s odděleným
namespace `all-stars`. Původní playoff namespace a jeho data zůstávají zachována.
Revize brání přepsání souběžné práce. Publikace ukládá ověřenou sestavu a
provenienci jako neměnný snímek; pozdější import nebo draft ji nezmění.
Veřejný endpoint nevrací pracovní výběr, přístupové hodnoty ani surové řádky.

Správa má jmenné výběry sezony, divize, týmu a hráčů, JSON přenos sestavy
ověřený proti aktuálním kandidátům a textový PNG export bez závislosti na CORS
fotografií. Nový veřejný výstup lze vložit do iframe, s jazykem v URL.

## Další modernizace, postupně

1. Dokončení All Stars: společné oficiální hvězdy, ověřené SO, backfill pozic,
   vizuální šablony a portréty, případně migrace historických sestav.
2. Porovnání týmů.
3. Pavouk playoff.
4. Betting / Sázkovka.
5. Porovnání hráčů do playoff: odlišná funkce od nynějšího přehledu počtu startů.
6. Player Cards.
7. PHM Cup Winners: dohledat původní řešení a přidat do Awards; nyní není hotové.
8. Our Team: ověřit persons API, oddělit veřejné sportovní/provozní profily
   od neveřejných osobních dat a zobecnit konfiguraci organizací.

Tento krok nerealizuje ostatní aplikace a nemění jejich stav na Ready.
