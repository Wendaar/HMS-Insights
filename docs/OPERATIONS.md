# HMS Operations

Vstup `/operations?org=phm`, centrální mapa `/control`. Společná aplikace a
serverová identita organizace; PHM ani její oprávnění nejsou fallbackem pro jiné organizace.
Používá skutečné logo z `public/hms-logo.png` a sdílený `hmsBrand`.

## Pracovní pohledy

- Graf **Směny podle lidí**: sloupce sestupně podle počtu přiřazení, barevné části
  podle soutěží. Přepínač předchozí/vybrané/následující období a filtr role.
  Kliknutí na člověka otevře jeho tabulku. Jedna směna je člověk × role × zápas.
- Zápasy obsahují Venue, soutěž, personál, platební režimy obou týmů a samostatné
  Payment Host / Payment Guest. Sloupce lze řadit; filtry se kombinují.
- Fakturace týmů obsahuje tým, soutěž, počet zápasů a příznak FAKTURY / CASH či
  HOTOVĚ / K ověření. Není zde počet dokončených zápasů ani „CASH účastí“.
- Uzávěrka má tři kroky: ověřit konkrétní hotovostní úhrady, stáhnout fakturační
  týmy a stáhnout personální podklady pouze za vybrané období. Neuzavírá měsíc
  a nevystavuje faktury. Bez sazeb nevypočítává mzdy ani částky fakturace.
- CSV exportuje filtrované údaje v UTF-8 se středníkem a ochranou proti vzorcům.
  Smyšlená ukázka je výslovně označená v aplikaci i názvu exportu.

## Platební pravidla

Režim je vlastnost **Team**. HOTOVĚ/HOTOVE/CASH znamená hotovost, FAKTURY/FAKTURA/
INVOICE fakturaci. Hledají se samostatné tokeny; CASHLESS není CASH. Chybějící
nebo nerozpoznaná hodnota není automaticky fakturační tým.

Úhrada je vlastnost **Game pro každou stranu zvlášť**. Domácí tým kontrolujeme
proti Payment Host, hostující tým proti Payment Guest. Žádný společný PAID
celého zápasu ani platba soupeře úhradu daného týmu nepotvrzuje.

Upozornění vzniká pouze pro datum před dnešním dnem v Europe/Prague, tým s
hotovostním režimem a jeho vlastní úhradu odlišnou od PAID. Výstup jmenuje tým,
soupeře, datum, Venue, soutěž a stav úhrady. NOT PAID je oddělené od chybějícího
údaje API. Budoucí, dnešní a zrušené zápasy nevytvářejí upozornění na dluh.

Mapování lze upřesnit serverovou proměnnou `HMS_<ORG>_OPERATIONS_RULES`, např.:

```json
{"cashPath":"foreignId","cashValues":["CASH","HOTOVĚ"],"invoiceValues":["FAKTURY"],"homePaidPath":"paymentHost","awayPaidPath":"paymentGuest","paidValue":"PAID","unpaidValues":["NOT PAID"]}
```

Automatické kandidáty model přijímá jen tehdy, když pole skutečně existuje;
jejich skutečnou dostupnost je potřeba ověřit na chráněném HMS zdroji.

## Datový tok a přístup

`GET /api/operations?org=phm&from=YYYY-MM-DD&to=YYYY-MM-DD&offset=0` vyžaduje
`Authorization: Bearer <HMS_PHM_OPERATIONS_SECRET>`. Nepoužívá webhookový secret
ani přístup jiné organizace. Kód zůstává jen v paměti prohlížeče, není v URL,
localStorage ani zdrojovém kódu. Zamknutí či změna organizace smaže kód a data.
Odpovědi mají `private, no-store` a `Vary: Authorization`.

Používá stávající organizační HMS token a `/games` se `status=ALL`, inclusive
`from/to`, stránkami po 20 a `skip`. Chybějící údaje doplňuje ze stejného `/game`;
veřejné sportovní názvy pouze při shodě obou týmů a data. Detail musí patřit
stejnému zápasu a organizaci. Normalizované detaily mají krátkou cache po org/game.

Prohlížeč načte všechny stránky (nejvýše 3 000 zápasů), odmítne duplicity nebo
neposouvající se kurzor a součty zobrazí až po potvrzení úplnosti celého rozsahu.
Předchozí a následující interval mají stejný počet dní jako vybrané období.
Do prohlížeče jde whitelist provozních údajů, žádné kontakty, tokeny, raw poznámky
nebo původní External ID. Neznámé údaje se výslovně označují.

Veřejný `action=access` vrací jen organizace a stav přístupu. Chráněný
`action=source-fields` slouží k ověření kontraktu: vrací jen názvy polí, datové
typy a rozpoznané platební značky, nikoli kontakty, text poznámek či API tokeny.

## Ověření

`node --test test/operations.test.js`: oddělení Payment Host/Guest, konkrétní
hotovostní dlužník, zákaz budoucích dluhů, fakturační filtr, ranking a segmenty
grafu, stránkování, organizační izolace, vázání detailů, bezpečné exporty a HTTP.
`node --test` ověří i stávající HMS aplikace. Produkční datové pokrytí se
ověřuje po nasazení s provozním kódem; ukázka jej nenahrazuje.

## Ověřené živé pokrytí 26. 10. 2026

Organizační přístup a živé zápasy, soutěže, Venue a personál byly ověřeny.
Aktuální chráněné API v1 `/games` ani `/game` ve skutečné odpovědi nevrací
Payment Host / Payment Guest. Vložené HomeTeam/AwayTeam vrací teamId, názvy,
status, loga a barvy, ale žádné External ID / foreignId. `/organization`
vrací identitu a branding, nikoli administrativní týmová data.

Proto jsou ve skutečných datech finanční režimy a úhrady zatím neznámé.
UI při neúplném pokrytí neukazuje nulu jako potvrzení bezproblémových plateb;
ukazuje „Neověřeno“. Fakturační filtr neznámé týmy automaticky nezařazuje.

Dokončení platební integrace vyžaduje rozšířit upstream výstup nebo dodat
administrativní čtecí endpoint s organizačním oprávněním. Potřebný kontrakt:

- u týmu stabilní teamId a External ID obsahující FAKTURY/HOTOVĚ/CASH;
- u zápasu stabilní gameId, organizationId, homeTeamId a awayTeamId;
- zvlášť skutečná úhrada domácích a hostů, se zdokumentovanými hodnotami PAID/NOT PAID.

Názvy těchto polí mohou být jiné; adaptér má organizační mapování. Stejný
kontrakt se musí použít pro ostatní organizace. Nepřebírat interní přihlašovací
cookie HMS, neukládat jeho osobní hesla a nezpřístupňovat finanční data veřejně.

## Oprava načítání měsíce

Sportovní názvy, Venue a personál se doplňují hromadně z rozpisu po dnech a
sezonách, s kontrolou přesného gameId, data, obou týmů a sezony. Více zápasů
stejného dne sdílí jeden dotaz; omezená cache a transport zachovávají limity
velikosti odpovědi a respektují rate limit HMS. Neveřejný zápas má individuální
fallback. Organizační oprávnění stále ověřuje chráněný seznam zápasů.

Přerušená stránka se automaticky zopakuje nejvýše dvakrát. Při delším výpadku
zůstanou dokončené stránky a kurzor pouze v paměti; tlačítko Pokračovat naváže
bez opakovaného zadání provozního kódu a bez dvojího započtení. Neúplné součty
se stále nevydávají za kompletní. Změna organizace, období či zamknutí zruší
původní běh; opožděná odpověď se nezapíše.

Chybový stav už nevrací přihlášeného uživatele k výzvě na zadání kódu. API
rozlišuje chybu zadání, rate limit, dočasné spojení a nekonzistentní zdroj;
pro diagnostiku zapisuje pouze bezpečný kód chyby, organizaci a kurzor.
Finanční pokrytí zůstává samostatná otázka upstream polí, nikoli důvod pádu
načítání běžných zápasů a směn.

## Obnovení stránky a detail člověka

Po zadání kódu vznikne 8hodinová, podepsaná organizační relace v host-only
HttpOnly/Secure/SameSite=Strict cookie. Samotný provozní kód se do browserového
úložiště ani do cookie neukládá. Secret rotace zneplatní dřívější relace.
POST `action=session` vyžaduje provozní kód; POST `action=logout` cookie ruší.
Obě operace kontrolují stejný origin. GET `action=access` sděluje, zda aktuální
cookie opravňuje ke čtení dané organizace; nevrací token ani kód.

Kompletní normalizovaný přehled, období, filtry a pohled zůstávají po dobu
10 minut v sessionStorage dané karty, odděleně pro organizace. Obnovení snímku
je dovoleno až po serverovém ověření platné relace. Neúplný, starý, poškozený
nebo cizí snímek se nepoužije. Po vypršení snímku se data načtou automaticky
bez nového zadávání kódu. Zamknutí smaže snímek i relaci.

Kliknutí na sloupec grafu nyní otevírá samostatný dialog s konkrétními daty,
časy, Venue, soupeři, soutěžemi a rolemi daného člověka za zvolené období grafu.
Počet řádků odpovídá počtu směn v příslušném sloupci. Hlavní vyhledávání se
kliknutím nemění. Export detailu používá skutečné období detailu.

NENÍ POTŘEBA / NENÍ TŘEBA / NOT REQUIRED / NOT NEEDED jsou výslovné značky
nevyžadované role, nikoli lidé či směny. Nezvyšují ranking a nevytvářejí chybu
chybějícího personálu. Skutečně neobsazená role se stále hlásí.

Pokud API neposkytuje External Id globálně, aplikace už nevytváří opakované
upozornění „platební režim týmu k ověření“ u každého zápasu. Zobrazuje jedinou
informaci o neúplném datovém připojení a počet různých týmů, nikoli počet jejich
opakovaných účastí. Hodnota je označená API neposkytuje. Fakturační/hotovostní
filtry jsou do zpřístupnění těchto polí neaktivní, aby prázdný výsledek nepůsobil
jako ověřený seznam bez fakturačních či hotovostních týmů. Skutečné platební
režimy se nadále nesmějí odhadovat podle názvů nebo ručně duplikovat mimo HMS.
