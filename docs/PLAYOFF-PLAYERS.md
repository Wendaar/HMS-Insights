# HMS aplikace: Hráči do playoff

První převod původního vloženého HTML bloku do samostatné aplikace.

- Správa: `/control/apps/playoff-players?org=phm&instance=phm-cup-2026`
- Veřejná verze: `/tools/playoff-players/phm/phm-cup-2026`
- Veřejná stránka nemá pás HMS, odkazy do správy ani patičku. Správcovské prvky
  se z jejího zobrazeného dokumentu odstraní; přístup ke změnám chrání API.
- Vložení: stejná adresa s `?embed=1` navíc používá průhledné pozadí a nemá vnější
  odsazení ani omezení šířky. Výstup tak přebírá prostor vložení na vašem webu.
- Control Center: karta **Hráči do playoff** v Competition. Obecné porovnání hráčů
  zůstává samostatná položka; tato aplikace kontroluje pouze počet startů.

## Pro správce

Odemkněte správu klíčem organizace. Upravte název, soutěž/sezonu, minimální počet
startů, barvu, body/fotografie, tabulku a záložku. Popisky soutěže a sezony jsou
oddělené od **skutečných filtrů zdroje**. Hodnoty filtrů musí přesně odpovídat
sloupcům Competition, Season a Phase (porovnání ignoruje velikost a diakritiku).
Prázdný filtr zahrne všechny řádky. Mapování sloupců lze změnit v pokročilém nastavení.

UI označuje dosavadní technický přístupový klíč jako **Heslo správce**. Není to
ID organizace, osobní přihlášení do HMS ani heslo, které si návštěvník zadá nově.
Jde o existující serverem nastavený administrátorský secret. Veřejný přehled
ani vložení do webu jej nepotřebují; nastavení parametrů je pouze ve správě.

1. **Ověřit data a náhled** čte aktuální zdroj podle rozepsaného formuláře.
2. **Uložit pracovní verzi** uloží konfiguraci centrálně, veřejný výstup nemění.
3. **Publikovat uloženou verzi** znovu ověří zdroj a atomicky publikuje uloženou
   pracovní verzi. Prázdný nebo chybný zdroj publikaci nezmění.
4. Stálý odkaz nebo iframe vložte na web. Další publikace jej aktualizují.
5. **Vytvořit z této sezony** vytvoří novou adresu a nepublikovanou kopii. Před
   zveřejněním upravte sezonu, zdroj a filtry.

Konfigurace je sdílená v databázi, nikoli v localStorage. Přístupový klíč zůstává
pouze v paměti otevřené správy, není v URL, kopírovaném iframe ani uloženém
nastavení. Souběžné změny porovnávají revizi; zastaralý zápis končí 409.
Veřejné API vrací pouze publikované nastavení vzhledu a povolená sportovní pole.
Chybějící GP znamená **Nelze ověřit**, nikoli nulu. Limit startů neznamená úplné
potvrzení způsobilosti podle soutěžních pravidel. Konfliktní duplicity hráče za
stejný tým vyžadují opravu zdroje/filtrů; statistiky se nesčítají ani neodhadují.

## Zdroj a připojení

Výchozí PHM výstup zachovává tabulku z dodaného HTML:
`2026 PHM Cup Statistics for AI`, ID `1MlsEBrd72RjeKS8vrnapjtu0KfIUaLciIYrEG_uc-rM`,
záložka `Players_Stats` (sheetId 1700599931), minimum 9 startů, Competition
`PHM Cup`, Season `2025-2026`, Phase `Základní část`. Při přípravě byly přes
Google Drive ověřeny metadata a hlavičky A1:Z3. Produkční přístup používá pouze
veřejný CSV export bez OAuth přihlašovacích údajů; jeho čitelnost je samostatná podmínka.
Načtení se opakuje po 15 minutách a ručně; jde o čas čtení, ne čas aktualizace Sheetu.
Při chybě obnovy zůstanou viditelná předchozí data s výslovným upozorněním.

Serverový Google Sheets adaptér má pevně sestavenou adresu, povolené pouze
Google datové redirecty, desetisekundový timeout a limit 4 MiB / 20 000 řádků.
Veřejný čtenář neumožňuje zadat libovolný zdroj. HTTPS obrázky přijímá pouze
z existujících HMS sportovních úložišť. Nepřebírá kontaktní údaje z tabulky.
Další datový adaptér může implementovat stejný model; přímé HMS API v této
verzi zatím není implementované a v UI se neprezentuje jako připojené.

## Provoz a nasazení

Používá existující `DATABASE_URL`. Tabulka z migrace `006_tool_instances.sql`
se může připravit ručně, nebo se vytvoří při prvním **autorizovaném uložení**.
Veřejné čtení ani náhled schéma nevytváří. Bez DB zůstává dostupný původní PHM
výstup z veřejné konfigurace; UI výslovně zakáže ukládání a publikaci.
Chyba DB se nikdy nepřepne potichu na výchozí publikaci.

Přístupový klíč: `HMS_<ORG>_TOOLS_ADMIN_SECRET`; pokud chybí, použije se vlastní
`HMS_<ORG>_WEBHOOK_SECRET`, u PHM také původní `HMS_WEBHOOK_SECRET`. Ostatní
organizace PHM klíč nepřebírají. Doporučené oddělení správy zajistí samostatný
TOOLS_ADMIN_SECRET. Nezavádí se nové uživatelské účty ani role. Práce probíhá
ve stávajícím modelu sdíleného administrátorského klíče, stejně jako importy.
Organizace se ověřují proti existujícímu serverovému registru. YHG nemá výchozí
PHM konfiguraci; FLLH musí mít před zapojením vlastní serverový záznam.

API `/api/tools` používá rewrite do již existující funkce
`/api/game-summary?view=tools`; počet Vercel funkcí se nezvyšuje. Původní výchozí
GameSummary, Studio a Player Cards routing je zachovaný. Správa není vložitelná
do iframe; veřejný výstup vložení povoluje. Ochrana Vercel Preview přihlášením
může iframe blokovat; na veřejném webu používejte až produkční adresu po nasazení.
Původní webové vložení se touto změnou automaticky nepřepisuje.

## Ověření

`node --test`: pravidla, CSV, neznámé hodnoty, filtry, mapování, izolace organizací,
autorizace před I/O, bezpečné chyby, SQL scope, revize, draft/publikace a kopie sezony.

`node scripts/playoff-players-browser.mjs`: celý tok přes skutečný HTTP handler
a sdílený testovací store (bez produkčních přístupů), samostatný veřejný prohlížeč,
změna limitu 9→12, uložení bez změny publikace, publikace, duplicita, chyby zdroje,
filtry, embed a mobil 390/320 px. Volitelně `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH`,
`PLAYOFF_TEST_OUTPUT`. Živé ukládání do produkční databáze tento test neprovádí.

Vercel Preview bylo ověřeno také se skutečným veřejným CSV zdrojem: načtení
hráčů, limit 9 startů a hledání bez diakritiky fungují. Původní Sheet zůstal
beze změny; do živé databáze se při tomto ověření nezapisovalo.
