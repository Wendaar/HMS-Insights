# Studio: další organizace a čeština/angličtina

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
Původní veřejné admin stránky pro import/backfill zůstávají původním PHM nástrojem;
nové organizace používají scoped webhook nebo uvedený serverový nástroj.

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

- `pnpm test`: 154 testů, včetně registry, cizích tokenů/UUID, odmítnutých webhooků,
  cache izolace, PHM výběru/archivu a CS/EN textů/časových filtrů Europe/Prague.
- `pnpm run build:static` a `git diff --check`.
- Prohlížeč: `scripts/studio-browser-check.mjs` (16 PNG),
  `scripts/studio-insights-browser.mjs` (20 PNG) a
  `scripts/studio-organizations-browser.mjs` (20 PNG) v headless Chromium.
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
