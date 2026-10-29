# Studio: další organizace a čeština/angličtina

## FLLH, YHG a POLICE — společná nabídka organizací

Ověřené organizační profily uživatele:

- `https://prod.hms.wootera.net/org/fllh/games` → code `FLLH`, slug `fllh`.
- `https://prod.hms.wootera.net/org/yhg/games` → code `YHG`, slug `yhg`.
- `https://prod.hms.wootera.net/org/police/dashboard` → code `POLICE`, slug `police`.

Nezaměňovat FLLH s dřívějším ilustračním kódem FLLLH ani s BNHLH. Původní
BNHLH zůstává samostatná organizace. Názvy/slugy výše neobsahují organization UUID
a samy o sobě nepřipojují skutečná data.

Ve Vercelu v existujícím projektu, Settings → Environment Variables, nastavit
pro Production (a samostatně požadovaný Preview) následující vlastní hodnoty:

| Organizace | UUID organizace v HMS | Vlastní API token |
| --- | --- | --- |
| FLLH | `HMS_FLLH_ORGANIZATION_ID` | `HMS_FLLH_API_TOKEN` |
| YHG | `HMS_YHG_ORGANIZATION_ID` | `HMS_YHG_API_TOKEN` |
| POLICE | `HMS_POLICE_ORGANIZATION_ID` | `HMS_POLICE_API_TOKEN` |

Potom provést nové nasazení. Ověřit identitu a známý zápas; přítomnost tokenu
není test úspěšného spojení. Žádné klíče neposílat do chatu, veřejných URL ani GitHubu.
Pro automatické Insights přidat vlastní `HMS_<ORG>_WEBHOOK_SECRET` a příslušnou
webhook URL `/api/webhooks/hms/org/fllh`, `/yhg` nebo `/police`. Pro publikování
All Stars / webu lze nastavit vlastní `HMS_<ORG>_TOOLS_ADMIN_SECRET`; stávající
fallback na vlastní webhook secret zůstává. Operations potřebuje vlastní
`HMS_<ORG>_OPERATIONS_SECRET` a tímto se automaticky neodemyká.

Jeden zdroj veřejných popisů je `public/organization-catalog.js`, který používá
i serverový registr `src/app/organizations.js`. Doplňující organizace a přejmenování
se dál registrují přes `HMS_STUDIO_ORGANIZATIONS` bez přidávání tokenů do JSON.
`/api/studio?catalog=1` vrací pouze code/slug/name/configured. Map, Media Studio,
Broadcast, katalog sponzorů a Operations jej používají pro nabídku organizací;
All Stars, Team Comparison a Site Builder mají discovery nad týmž serverovým registrem.
Site Builder nabízí připojené organizace; veřejný web navíc vyžaduje publikaci.

Nepřipojené organizace v mapě nemají aktivované nástroje. Po připojení dostanou
vlastní generické cesty pro podporované aplikace, ne kopie PHM odkazů. Starší
sheetové aplikace zůstávají pro nové organizace nepřipravené. OBS kanály a knihovna
přijímají registrované organizace; kanál stále vyžaduje vlastní datové připojení.
Žádné nové přihlašovací údaje, historie ani webhooky tato úprava sama nevytváří.

Následující původní příklady Yellow/FLLLH jsou pouze ukázkou rozšíření registru,
nikoli nastavením výše uvedených tří subjektů.

Jedna aplikace, jeden GitHub repozitář a jeden projekt Vercel. Organizace se
neklonují. Kód připravuje veřejný prototyp; připojení skutečných dalších organizací
vyžaduje jejich serverové nastavení. Žádné nové produkční klíče nejsou součástí PR.

## Adresy po nasazení

- PHM: `/studio/phm?lang=cs` nebo `/studio/phm?lang=en`.
- Původní `/studio` dál otevře PHM a přepíše adresu na její konkrétní cestu.
- `/studio/PHM` funguje také; kanonická adresa má malá písmena.
- `/studio/yellow?lang=en` či `/studio/flllh?lang=cs` fungují **po přidání jejich
  záznamu a připojení** níže. Jde o příklady názvů, ne automatické ztotožnění Yellow
  s YHG nebo FLLLH s BNHLH.
- Přepínač organizace zachová jazyk, přepínač jazyka zachová organizaci. Adresu lze
  sdílet a obnovit. Neznámý slug neotevře data PHM.

Základ adresy: `https://hms-insights-five.vercel.app`. Preview Vercelu může dál
vyžadovat Vercel login podle Deployment Protection. Pro veřejný feedback použijte
produkční adresu až po sloučení/nasazení této změny. Přístup do Studia nepředává
přístup k HMS ani serverovým klíčům.

## Oddělené veřejné Příklepy a archiv

Původní `/priklepy`, `/archiv` a `/` zůstávají PHM. EUCHL má vlastní
`/priklepy/euchl` a `/archiv/euchl`; stejný vzor platí pro další registrované slugs.
Název organizace je v titulku a záhlaví, odkazy na výběr/archiv zůstávají v jejím
prostoru. CSS/JS/ikony používají správné absolutní cesty i na vnořené stránce.

Organizační omezení platí na první HTML, nabídky filtrů, celkový počet, hledání,
filtry i další stránky historie. `/api/selection` a `/api/feed` používají org UUID
z registru, bez parametru vždy PHM. Klient bere org kód ze serverem vložených
metadat stránky a drží ho při všech dalších požadavcích, i po výměně výsledků.
Odpověď s odlišným org kódem se nezobrazí. Neznámé organizace končí chybou, nikdy
PHM fallbackem. U původních stránek je path PHM nadřazen konfliktním org parametrům;
Vercel rewrite navíc nastavuje jejich pevné `feedOrg=PHM`.

Tyto adresy nejsou přístupová brána; obsah je stále veřejný sportovní prototyp.
Izolace stránky brání směšování organizací, nepředstírá přístupová oprávnění.

**Pořadí nasazení:** Nejdřív nasadit tento PR s úplným oddělením veřejných čteček,
až potom spouštět EUCHL webhook/import historie do sdílené databáze. Původní
produkční kód před tímto PR nebyl připraven na veřejný feed více organizací.

## Co nastavit v HMS pro každou organizaci

1. Ve správném organizačním profilu zapnout API a vytvořit jeho vlastní API token.
   Poznamenat správné organization UUID. Token musí skutečně patřit dané organizaci.
2. Zpřístupnit read-only endpointy `/organization`, `/games`, `/game`, `/gameEvents`
   a `/gameLineup`. Fotografie/loga se přebírají z existujících veřejných sportovních
   metadat; při jejich nedostupnosti zůstávají připravené fallbacky či lokální upload.
3. Pro automatické nové Příklepy aktivovat webhooky `game.finished` a `game.updated`
   na organizační URL níže, s **vlastním** webhook secretem této organizace. Stávající
   ověřování podporuje `Authorization: Bearer <secret>` nebo
   `x-hms-webhook-secret`. Tento přírůstek nepřidává HMAC ověřování.
4. Odeslat testovací ping a následně skutečný ukončený zápas. Importer vyžaduje
   FINISHED a ověřuje organization UUID z notifikace i načteného zápasu.
   `game.updated` zůstává opravou ukončeného zápasu; tato změna nezavádí live webhook.

Žádný zápis do HMS. Refresh ve Studiu pouze čte a obnovuje paměťovou cache.

## Co nastavit ve Vercelu

V existujícím projektu **HMS-Insights → Settings → Environment Variables**.
Hodnoty tokenů a secretů vkládat přímo tam jako citlivé proměnné. Neposílat do chatu,
GitHubu, URL, screenshotů ani klientských `NEXT_PUBLIC_*` proměnných.

Veřejný seznam organizací je serverová proměnná `HMS_STUDIO_ORGANIZATIONS`, JSON
pole **pouze s popisy**, například:

```json
[
  {"code":"YELLOW","slug":"yellow","name":"Yellow Hockey"},
  {"code":"FLLLH","slug":"flllh","name":"FLLLH"}
]
```

Názvy výše jsou příklady, před použitím potvrdit správný název a kód organizace.
Základní PHM, EUCHL, YHG a BNHLH existují i bez této proměnné. Položka stejného `code`
umí změnit jejich název a slug při zachování starého organizačního klíče lokálních
nastavení. Například pokud Yellow skutečně je existující YHG, použít
`{"code":"YHG","slug":"yellow","name":"Yellow Hockey"}` a proměnné `HMS_YHG_*`;
nezakládat současně YELLOW. `code` zůstává stabilní, slug by se po sdílení také
neměl měnit. Registry má maximálně 32 doplňujících záznamů, unikátní slugs, code z
velkých ASCII písmen/číslic/podtržítka a slug z malých ASCII písmen/číslic/pomlček.
Změna registry je serverové nastavení, žádný veřejný formulář pro úpravy neexistuje.

Pro uvedený příklad přidat:

| Vercel proměnná | Hodnota |
| --- | --- |
| `HMS_YELLOW_ORGANIZATION_ID` | Skutečné organization UUID Yellow z HMS |
| `HMS_YELLOW_API_TOKEN` | Vlastní read-only token Yellow |
| `HMS_YELLOW_WEBHOOK_SECRET` | Vlastní webhook secret Yellow |
| `HMS_FLLLH_ORGANIZATION_ID` | Skutečné organization UUID FLLLH z HMS |
| `HMS_FLLLH_API_TOKEN` | Vlastní read-only token FLLLH |
| `HMS_FLLLH_WEBHOOK_SECRET` | Vlastní webhook secret FLLLH |

Společná existující `DATABASE_URL` zůstává. PHM dál používá původní `HMS_API_TOKEN`
a `HMS_WEBHOOK_SECRET`; volitelně je mohou nahradit `HMS_PHM_API_TOKEN` a
`HMS_PHM_WEBHOOK_SECRET`. Ostatní organizace je **nikdy nepřebírají**.

Proměnné nastavit pro Production; pro testování také pro odpovídající Preview
prostředí/větev. Po změně proměnných provést nové nasazení — běžící nasazení je
nepřevezme. V GitHubu už není třeba přidávat další větev, aplikaci ani kopii projektu.
Žádná databázová migrace není nutná. Přidání organizace nevytváří další Vercel funkci.

Organizační webhook URL pro příklady:

- `https://hms-insights-five.vercel.app/api/webhooks/hms/org/yellow`
- `https://hms-insights-five.vercel.app/api/webhooks/hms/org/flllh`

Původní `/api/webhooks/hms/game-finished` zůstává PHM. Chybný secret jiné organizace
je odmítnut; org nelze vybrat libovolným UUID v těle webhooku. Klíče se neposílají
ve Studio GET požadavcích. Odpovědi webhooků/diagnostiky neobsahují interní chyby.

## Pořadí zprovoznění a kontrola

1. Sloučit a nasadit PR s routingem/registry/jazyky; stávající PHM ověřit jako dříve.
2. Připravit připojení dané organizace v HMS a proměnné ve Vercelu; redeploy.
3. Otevřít `/studio/<slug>?lang=en`, zkontrolovat organizaci, Today/Past, názvy týmů,
   výsledek známého zápasu a export. Hodnota `configured` v bezpečném katalogu
   `/api/studio?catalog=1` znamená pouze přítomnost UUID/tokenu, ne ověření spojení.
4. Otestovat HMS ping a import dokončeného zápasu přes správnou webhook URL.
   Insights čte uložené Příklepy, takže bez importů bude knihovna nové organizace
   prázdná, i když Games už z HMS fungují. Refresh Příklepy negeneruje.
5. Ověřit, že PHM neukazuje zápasy nové organizace, oba exporty fungují z mobilu,
   a že změna barev/partnera jedné organizace neovlivní jinou.

Pro read-only ověření identity v důvěryhodném serverovém shellu s už nastavenými
proměnnými lze použít (Node 20+, závislosti nainstalované):

```bash
node scripts/organization-setup.mjs --org yellow
```

Pro jednorázové naplnění historie, **až po ověření identity**, stejný nástroj
explicitně povolí import do naší DB. Používá existující FINISHED-only generátor,
stránkování 10 zápasů, organizační kontrolu a pauzu 1,8 s mezi zápasy. Jeden běh
má rozsah nejvýše 31 kalendářních dnů:

```bash
node scripts/organization-setup.mjs --org yellow --import --from 2026-10-01 --to 2026-10-22
```

Klíče se nástroji nepředávají v argumentech a nástroj je nevypisuje. Import do HMS
nezapisuje, naše uložené snapshoty stejného zápasu se při opakování aktualizují.
Import lze spustit také z prohlížeče:

- `/admin/backfill?org=EUCHL` — historie EUCHL v období nejvýše 31 dnů včetně
  krajních dnů. Výchozí je posledních 31 kalendářních dnů Europe/Prague včetně dnes.
- `/admin/import-game?org=EUCHL&gameId=<UUID>` — jeden konkrétní dokončený zápas.
- Bez `org` zůstávají tyto admin stránky a POST API kompatibilně PHM.
- Stejné odkazy fungují s kódem nebo slugem další organizace z registru.

Do heslového pole se ručně zadává **Signing secret dané organizace** z HMS; nikoli
API token. Serverové proměnné se do HTML ani JS nevkládají. Ručně zadaný secret je
pouze v paměti aktivního importu, přenáší se v Authorization headeru do stejného
originu, neukládá se do URL/storage a po dokončení nebo chybě se pole vymaže.
Klient během běhu uzamkne vstupy a chrání před nechtěným zavřením stránky. Odkaz
na Příklepy po úspěchu má časový parametr pro obejití starého CDN HTML cache.

POST `/api/admin/backfill?org=EUCHL` vyžaduje org secret a JSON
`{"from":"2026-09-22","to":"2026-10-22","skip":0}`. Načítá nejvýše jeden
FINISHED zápas za volání. Klient pokračuje podle nextSkip, mezi stránkami počká
2,5 s a dočasnou síťovou/serverovou chybu zkusí nejvýše třikrát. Chybné ověření ani
neplatné vstupy neopakuje. Import zůstává idempotentní díky stávajícím transakčním
snapshotům; cizí org, zdroj mimo datumové okno nebo překročený limit stránky se
odmítají před zpracováním. Org secret je nutný ještě před čtením HMS či změnou DB.
Původní PHM API požadavek s `from` + `seasonId` bez `to` zůstává podporovaný pro
staré klienty; nový formulář používá vždy omezené období.

Testy tohoto doplnění: 165 Node testů, static build a
`scripts/organization-import-browser.mjs` (syntetické dva zápasy, scoped auth,
stránkování, retry 503, neplatné období, vyčištění secretu, mobil 390 px). Reálný
import EUCHL musí spustit správce přes svůj formulář; žádné skutečné importy se
během těchto testů neprovádějí.

## Jazyky

`?lang=cs` a `?lang=en`, výchozí čeština. Nepodporovaná hodnota přejde na češtinu.
Překládá se editor, vyhledávání, stavové zprávy, bezpečné API chyby a pevné texty PNG
(včetně konce třetiny, partnera, statistik a fallbacků). Česká verze zachovává
mezinárodní názvy stylů a šablon jako Final Score / Hattrick Hero. English verze
výkonů používá existující typ výkonu a ověřené čítače; při chybějícím čítači použije
obecný popis bez vymyšleného čísla. Neukládá druhou kopii výkonu do DB.

Jména, názvy soutěží/skupin/fází/týmů a vlastní text partnera jsou původní data.
Například fáze nazvaná v HMS „Základní část“ zůstane takto i v anglickém PNG.
Vlastní text budoucího neznámého typu Insight se automaticky nepřekládá.
Jazyk v URL platí pro Studio; tento PR nepřekládá celé původní Příklepy/Game Report.
Nastavení vzhledu zůstává po organizaci a společné oběma jazykům na daném zařízení.
Pantha má dál bezpečný fallback celého textu pro nepodporované znaky.

## Ověření tohoto přírůstku

- `pnpm test`: 158 testů, včetně registry, cizích tokenů/UUID, odmítnutých webhooků,
  cache izolace, PHM výběru/archivu a CS/EN textů/časových filtrů Europe/Prague.
- `pnpm run build:static` a `git diff --check`.
- Prohlížeč: `scripts/studio-browser-check.mjs` (16 PNG),
  `scripts/studio-insights-browser.mjs` (20 PNG) a
  `scripts/studio-organizations-browser.mjs` (20 PNG) v headless Chromium.
  `scripts/public-feed-organizations-browser.mjs` navíc ověřuje oddělené veřejné
  HTML/API, hledání, filtry, stránkování, počty, navigaci, chybnou odpověď a mobil.
  Ověřují obě velikosti, fonty, pět stylů, EN texty v canvasu, reload a změnu org,
  přepnutí jazyků, stránkování, neznámé org, lokální izolaci a šířku 390 px.
- Veřejný baseline původní produkce ověřen 2026-10-22 před tímto PR: Studio,
  Příklepy a Game Report HTTP 200; F6321894-98CA-11F1-8BDF-EF2495D048F3 skutečně
  vrací 5:10 a 4 Příklepy (historické očekávání 9:3/10 platilo pro jiné gameId).
  Today vrací 5 naplánovaných zápasů NOT PLAYED. To je kontrola stávající produkce,
  nikoli tvrzení, že nová větev už je nasazená.
- Fixtures jsou syntetické; nepředstavují ověření skutečného připojení Yellow či
  FLLLH. Jejich UUID/tokeny zatím nebyly poskytnuty/nastaveny a nejsou v repozitáři.

## Provozní hranice prototypu

Veřejný Studio GET poskytuje jen sportovní data povolených organizací. Cesta není
přístupová brána: uživatelé mohou přepínat organizace a data jsou veřejná. Sdílejte
pouze organizace, jejichž provozovatel s takovým veřejným prototypem souhlasí.
Není zde veřejný zápis do HMS ani sdílené konfigurace. Ověřený webhook smí zapisovat
jen snapshoty ukončených zápasů své organizace do naší DB.

Před ostrým provozem je povinná autentizace a org-based authorization pro Studio,
API i assets podle požadované politiky a distribuované řízení limitů HMS. Současné
cache/concurrency jsou lokální na instanci. Předchozí omezení live dat a neověřeného
ukončení třetiny tímto PR neměníme. Vercel připojení se nastavuje přímo ve Vercelu;
tento PR nemá přístup k jeho tajným proměnným ani k HMS profilům dalších organizací.
