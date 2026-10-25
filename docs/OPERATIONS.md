# HMS Operations · první pracovní verze

Vstup `/operations?org=phm`, společný zdroj HMS a samostatná větev centrální
mapy `/control`. Žádná další databáze zápasů ani PHM logika ve výpočtech.
Organizace se ověřuje serverovým registrem `src/app/organizations.js`.
EUCHL, YHG a další připojené organizace používají stejnou aplikaci a vlastní
token, identitu, provozní kód a mapování polí. FLLH z mapy vyžaduje nejprve
řádné přidání do serverového registru; není zaměňována s BNHLH.

## Co funguje

- Kontrolní přehled s menšími grafy zápasů podle soutěží a směn v čase.
- Tabulky zápasů, lidí/rolí/soutěží, týmových podkladů a kontrol před uzávěrkou.
- Kombinované filtry období, soutěže a člověka/týmu; export právě filtrované tabulky
  do CSV v UTF-8 se středníkem a ochranou proti vzorcům.
- Více lidí v poli je rozděleno podle pole/seznamu nebo čárky, středníku a nového
  řádku; duplicitní jméno ve stejné roli v jednom zápase se počítá jednou.
- Předchozí a následující období mají stejný počet kalendářních dní jako vybrané
  období. Nejde automaticky o sousední kalendářní měsíce.
- Chybějící rozhodčí/časoměřič, budoucí led bez obou soupeřů, minulý zápas bez
  soupeřů, nepotvrzené platby CASH a neznámé zdrojové hodnoty.
- Zrušené/smazané zápasy se nezapočítávají do směn a týmových podkladů.
- Veřejná explicitně označená ukázka s výhradně smyšlenými údaji.

## Živá data a přístup

`GET /api/operations?org=phm&from=YYYY-MM-DD&to=YYYY-MM-DD` vyžaduje
`Authorization: Bearer <HMS_PHM_OPERATIONS_SECRET>`. Jde o samostatný divácký
kód, bez fallbacku na webhookový secret nebo klíč jiné organizace. Kód se
v prohlížeči drží jen v paměti, není v URL ani localStorage. Zamknutí nebo změna
organizace jej smaže, zahodí data i opožděnou odpověď.
Veřejný `action=access` vrací jen seznam organizací a stav nastavení přístupu.
API odpovědi mají `private, no-store` a `Vary: Authorization`.

Aplikace čte existující serverový HMS `/games` se `status=ALL`, inclusive
`from/to`, `limit=100` a `skip`. Načte celý rozsah všech tří období, nejvýše
1 000 zápasů, s celkovým timeoutem. Nepotvrdí součty z částečných dat. Každý
zápas musí patřit organizaci a datovému rozsahu; duplicita stránky či cizí zápas
zastaví celý přehled. Do prohlížeče jde jen whitelist provozních polí, bez
e-mailů, telefonů, raw poznámek, tokenů a identifikátorů z pole foreignId.

HMS `/games` nemusí vracet všechny potřebné detaily. Nepřítomné pole personálu
znamená „není ve zdroji“, explicitní null/prázdný seznam „chybí obsazení“.
Přehled nesmí chybějící pole potichu vydávat za ověřené prázdné hodnoty.
Před produkčním použitím je nutné na reálném payloadu ověřit úplnost detailů;
případný detailový adaptér patří do společné datové vrstvy.

## CASH a PAID

Bez potvrzeného mapování jsou hodnoty neznámé. Serverová konfigurace organizace
`HMS_PHM_OPERATIONS_RULES` je JSON, např. až po ověření skutečných polí:

```json
{"cashPath":"foreignId","cashValue":"CASH","paidPath":"paymentStatus","paidValue":"PAID","unpaidValues":["UNPAID"]}
```

`cashPath` je cesta v objektu týmu; CASH se hledá jako samostatný token, nikoli
podřetězec. `paidPath` je cesta v zápasu. Hodnoty plateb se porovnávají přesně
(včetně typu), neznámé hodnoty nejsou automaticky nezaplacené. Pokud HMS vede
úhrady pro každý tým zvlášť, musí se tento kontrakt změnit před živým použitím;
současný PAID je stav celého zápasu dle zadání. CASH upozornění se vztahuje
k datům před dnešním dnem v Europe/Prague. Absence obou soupeřů je potenciál
volného ledu, nikoli potvrzená finanční ztráta.

## Hranice a další rozhodnutí

Současná uzávěrka je kontrola a export počtů. Nevystavuje faktury, neprovádí
výplaty, neukládá schválení a nepředstírá konečné uzavření. Chybí potvrzení
sazeb, plánované vs. odpracované směny, storna/náhrady, DPH a účtování domácího
a hostujícího týmu. Lidé bez stabilního HMS ID se agregují podle jména a role;
shodná jména různých osob vyžadují další identifikační kontrakt.

Veřejná dostupnost URL nevyžaduje účet GitHub/Vercel. Hostingová ochrana nasazení
musí umožnit veřejný shell, přístup k provozním datům chrání API. Před širším
nasazením nahradit sdílený organizační kód osobním přístupem s rolemi a auditem,
potvrdit pravidla CASH/PAID a účetní pravidla. Aplikace nic nezapisuje do HMS.

Lokálně: `npm start`, pak `/operations?org=phm`. Testy: `node --test test/operations.test.js`.
