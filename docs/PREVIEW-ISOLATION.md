# HMS — etapa 1: izolovaná Preview databáze a přístupy

Stav: **izolované Preview je aktivní, databáze i nasazené HTTP kontrakty ověřené**. Uživatel schválil prázdnou statickou inicializaci pouze nového sandboxu a následné Preview nasazení. Žádný merge, deployment do stávající HMS produkce, změna jejích env/domén nebo existujících OBS/Camera relací. Souhrn živých kontrol je v [preview-isolation-evidence.json](preview-isolation-evidence.json). Podrobná lokální provozní evidence a inicializační nástroje zůstávají v pracovním adresáři `work/hms-stage1/`; neobsahují uložené plaintext secrets.

## Vytvořené prostředí

| Součást | Identita a rozsah |
|---|---|
| Nový Vercel projekt | `hms-insights-preview`, `prj_ZevOpX8rnsypB6yAkcNThRNxh2Zi` |
| Nový Neon projekt / store | `bold-dawn-88451319` / `store_aDY57twQaDqb7h2v`, jméno `hms-insights-preview-db` |
| Plan | existující Neon Marketplace instalace `free_v3` / Free; žádný placený upgrade |
| Data | nová prázdná databáze, schema ze všech 9 verzovaných migrací; pouze syntetické fixture záznamy |
| Aplikační DB / role | `hms_preview` / `hms_preview_app`, samostatné náhodné heslo |
| DB endpoint | `ep-ancient-tree-bbl53ck0.c-15.us-east-1.aws.neon.tech` |
| Vercel env scope | všechny nové aplikační/proměnné pouze `preview`, bez Git propojení a produkčních custom domén |
| Deployment protection | `all_except_custom_domains`; žádná ochrana produkce se nemění |
| Nasazení | READY Preview `dpl_2Z89nfLnH49VpAeFGir8Cht37N9h`, žádné crony; nový sandbox má jen schválený prázdný statický první Production-labelled deployment |

DB vznikla jako nový Neon projekt, **nikoli klon nebo branch produkční databáze**. Nebyly kopírovány registrační údaje, jobs, session hashes, kamerové relace, OBS kanály ani produkční role. Samostatný Free projekt také odděluje jeho projektovou kvótu od současného Neon prostředku, nikoli billing a limity celého Vercel účtu.

Provider použil výchozí DB region US East. Jsou zde jen syntetická data a tato instance zatím není vhodná pro srovnávací latency benchmark s produkční DB/regionem. Přesun regionu ani nové placené kapacity tento krok nezahrnuje. Vercel projekt deklaruje Node 24; nasazený Preview snapshot uvádí Node 26.x / fra1, stejně jako dříve pozorovaný rozdíl dashboard/runtime. Tento krok nemění Node verzi produkce.

## Privilegia a secrets

`hms_preview_app` není superuser, nemá CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS ani INHERIT a není členem `neondb_owner`. Vlastní jen novou databázi, takže současné lazy CREATE TABLE/migrace fungují uvnitř Preview. Jde o aplikační+migrační roli, nikoli konečné rozdělení na read-only reader a schema migrator. Nemůže se připojit k defaultní administrátorské DB `neondb`. Grant nové app role administrátorovi byl použit pouze k přiřazení vlastníka DB; opačný grant app → administrator neexistuje.

Pro inicializaci byl nový prostředek dočasně připojen **jen k novému projektu a jen Preview** pod prefixem `HMS_BOOTSTRAP`. Po vytvoření omezené role a migraci bylo toto spojení odstraněno. Žádné provisioning/owner credentials v aplikačním Preview nezůstávají; databáze sama nebyla smazána. Odpovídající administrátorské prostředky zůstávají pod správou Marketplace, ne v runtime aplikace.

Vercel uchovává novou DATABASE_URL a náhodné admin kódy šifrovaně. PHM, EUCHL, BNHLH a YHG mají každý vlastní nové `TOOLS_ADMIN_SECRET`, `PORTAL_ADMIN_SECRET` a `OPERATIONS_SECRET`. Hodnoty se nevypisují do logů/Git ani nedávají do veřejné URL. Produkční hodnoty se nekopírovaly ani nerotovaly.

Preview neobsahuje živé HMS API tokeny, OpenAI, Flickr, Blob, Supabase ani cron/provider klíče. Proto plnohodnotné HMS browse, analýzy fotografií, upload zvuků či scheduler nejsou v tomto fixture prostředí připravené; chráněné/nenakonfigurované funkce mají odmítnout požadavek. Nejde o poruchu nebo důvod doplnit produkční klíč. Pro pozdější živá data je nutný samostatný ověřený read-only sandbox přístup a samostatná revize této politiky.

## Ochrana v kódu

`src/security/preview-environment.js` je prvním importem všech 12 API entrypointů, serveru, build-media-client, ingest a seed skriptů. Pro `VERCEL_ENV=preview` kontroluje ještě před spuštěním aplikačního kódu:

- Vercel project ID se shoduje s explicitním Preview bindingem a není původním produkčním projektem.
- DATABASE_URL patří povolenému Neon endpointu, DB `hms_preview` a roli `hms_preview_app`, má heslo a vyžaduje TLS. Pooled/unpooled host stejného endpointu jsou ekvivalentní.
- Případné alternativní Postgres URL/host/user/database proměnné neodkazují jinam.
- Nejsou přítomné zakázané živé API/provider ani bootstrap přístupy; organizační admin secrets mají vyhrazený Preview prefix.

Při nesplnění se build/start odmítne s generickou chybou bez URL či hesla. Chybějící konfigurace není fallback na produkci. V Production a lokálním Development je tato ochrana no-op, takže nemění staré tabulky, namespace, cookie/session formáty ani sportovní chování. Kód nebyl nasazen do produkce. Kontrola se spouští i přes `node scripts/check-preview-configuration.js` v prostředí s vyhrazenými Preview env; nic nemění a nevolá DB.

Guard není náhradou za fyzickou izolaci databáze a správu přístupů Vercelu. Neochrání před správcem, který změní samotnou politiku nebo nasadí jiný kód, ani před chybou běžícího starého deploymentu. Zaměstnanci s Vercel administrací mají i nadále svou dosavadní odpovědnost.

## Ověření

Lokální sada: **624 passed, 0 failed, 0 skipped** (620 původních + 4 nové testy). Nové testy kontrolují fail-closed bez konfigurace, odmítnutí cizí DB/role/project/credential, nezměněné Production chování a pokrytí všech entrypointů.

Živé testy proběhly z lokálního test runneru proti **nové Preview DB**, nikoli HTTP na produkci:

1. Správná DB/role, žádné členství administrátora.
2. CREATE DATABASE a CREATE ROLE odmítnuty.
3. Připojení k defaultní administrátorské DB odmítnuto.
4. Oddělené draft/published fixture řádky PHM/EUCHL/BNHLH/YHG.
5. Správný admin kód pro každou organizaci, cizí kód 401 a neznámá organizace 404.
6. Stará revize nepřepíše současnou práci.
7. Nová testovací Camera session: read/edit role, read PUT 403, chybný klíč 403, správný PUT 200, stará revize 409, heartbeat a report 200.
8. Broadcast store: vlastní Preview tabulky, revision/library a zachování hidden stavu.
9. Žádné živé provider a bootstrap klíče v runtime konfiguraci.

Neplatné Portal main drafty z prvního testovacího běhu byly odstraněny **jen z nové DB** a fixture data jsou v samostatném `stage1-fixture` namespace. Nové syntetické Camera/Broadcast řádky nemají živý video zdroj a jejich klíče nebyly publikované. Reálné OBS ani video/audio zde nebyly testovány. Broadcast store test není důkaz živého OBS end-to-end fungování.

Po nasazení prošlo také **6 HTTP kontrol** chráněného Preview: Control shell 200, Studio katalog bez nakonfigurovaných živých HMS přístupů, vlastní/cizí administrační kódy všech čtyř organizací, odmítnutí cronů bez klíče a nenakonfigurovaného webhooku, nová syntetická Camera relace (201/200, read PUT 403, stará revize 409) a Camera output HTML s původním CSP. Nebyl spuštěn browserový JavaScript ani video. Pro HTTP test vznikl dočasný automation bypass pouze v novém sandboxu; v `finally` byl odvolán a následná anonymní žádost znovu skončila na SSO ochraně. Žádný bypass nebo aplikační klíč se neukládá do evidence.

## Nasazení a meze dokončení

Vercel vyžaduje pro nový projekt první deployment označený Production. Po výslovném souhlasu uživatele vznikl pouze v novém sandboxu statický bootstrap `dpl_H3DBN5h85dkr55kb3X1gL5hMeLvy`: dvě statické položky, nulové funkce/crony/aplikační secrets, bez přiřazených aliasů díky `--skip-domain`. Produkční URL HMS se nepřepínaly. Aplikace byla potom nasazena výhradně jako Preview.

Aktivní chráněná adresa: [Preview Control Center](https://hms-insights-preview-df7sdu7jn-wendaar.vercel.app/control). Uživatel potřebuje svůj Vercel přístup; žádný veřejný bypass odkaz se nevytváří. Runtime kód odpovídá commitu `6d556225ac2678609499549912be528e96f89db1`; pozdější změny tohoto PR doplňují dokumentaci a důkazy aktivace.

Nasazovací snapshot obsahuje fyzicky upravený `vercel.json` s **prázdným crons polem**; produkční soubor v repozitáři se nemění. První Preview pokus převzal původní cron definice, které se v Preview targetu nespouštějí. Proto byl vytvořen oddělený snapshot pouze z tracked souborů a správný konfigurační soubor přímo nahrán. Aktivní deployment má `crons=[]` a také projektové naplánované cron definice jsou prázdné. Samotný `--local-config` přepis nestačil jako důkaz obsahu nasazeného souboru. Guard úspěšně prošel buildem i HTTP runtime.

## Staré Preview a další postup

Současný projekt `hms-insights` a jeho původní Neon/Blob propojení, produkční env metadata, domény a běžící immutable deploymenty zůstávají beze změny. Staré Preview URL **nejsou tímto krokem dodatečně zabezpečené** a mohou držet původní credentials. Jejich revokace/odstranění by mohla zasáhnout používané odkazy a není součástí tohoto běhu. Nové testovací writes nesmějí používat tato stará prostředí.

Důležité upřesnění etapy 0: společný DATABASE_URL metadata záznam není sám o sobě důkaz, že konkrétní starý Preview deployment skutečně běží na produkční větvi. Neon native integrace může ve chvíli deploye injektovat vlastní branch URL mimo project env settings. Tento mechanismus u starých deploymentů nebyl nezávisle ověřen. Nové prostředí se této nejistotě vyhýbá vlastním prázdným projektem a DB/rolí, bez závislosti na automatickém branchingu.

Při pushi této pracovní větve může původní Git propojení automaticky spustit Preview build na starém projektu. Guard ho úmyslně odmítne, protože to není povolený nový sandbox; toto odmítnutí bylo ověřeno i v build logu. Takový červený Preview check není produkční výpadek. Samostatný nový sandbox se nasazuje explicitně a není připojen ke Git auto-deployům. Větev nemergovat bez samostatné autorizace produkčního rollout plánu. V dlouhodobém monorepu bude mít každá aplikace svůj explicitní projektový binding; nynější politika je pro první společný fixture sandbox, ne definitivní obecný deployment systém.

Rollback: nenastavovat zpátky produkční DB do Preview. Pro deaktivaci stačí přestat prostředí používat a zablokovat nové Preview deploye. Nové projekty/databázi nemažte bez samostatného rozhodnutí; produkci není potřeba vracet, protože se neměnila. Pozdější smazání izolovaných prostředků nikdy nesmí použít původní production project/store ID.

Oficiální podklady: [Vercel-managed Neon integrace a runtime branch overrides](https://neon.com/docs/guides/vercel-managed-integration), [Vercel integration lifecycle](https://vercel.com/docs/cli/integration), [Neon plans](https://neon.com/docs/introduction/plans). Konkrétní Free plán byl ověřen i autentizovanou odpovědí instalace a nově vytvořeného prostředku; nepředpokládá se jen z veřejného ceníku.
