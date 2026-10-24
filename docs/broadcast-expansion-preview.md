# Broadcast Studio · rozšíření k otestování

Větev `codex/broadcast-expansion-preview` je určená k odsouhlasení. Nemergovat a nepřepínat produkční doménu před schválením vlastníkem. Původní OBS adresu pro dnešní přenos není potřeba měnit.

## Kde začít

- `/broadcast/demo.html`: samostatná galerie nových vrstev se **smyšlenými, označenými daty**. Nevolá HMS, nevytváří kanál a nemění OBS. Vlastní QR/logo lze vyzkoušet pouze v paměti stránky; po obnovení zmizí. QR obrázek v ukázce je zástupný, není to funkční QR kód.
- `/broadcast/index.html?org=EUCHL`: skutečný ovladač. Na preview zobrazuje pruh TESTOVACÍ VERZE. Načíst zápas, vytvořit **nový testovací kanál**, zkopírovat jeho veřejnou adresu do samostatného testovacího zdroje OBS. Nepoužívat soukromý ovládací odkaz produkčního kanálu v preview.
- Vercel ochrana preview zůstává zapnutá. Pokud OBS vidí přihlášení Vercelu, přihlašovací stránka není chyba vrstvy. Ochranu kvůli testu nevypínáme; vzhled lze zatím ověřit v přihlášeném prohlížeči a v galerii.

## QR výzvy a partneři

V ovladači rozbalit **Knihovna QR výzev a partnerů**. Nejprve je potřeba připojený OBS kanál, protože zápis chrání jeho soukromý ovládací klíč.

1. Vybrat typ QR výzva nebo Partner.
2. Vybrat organizaci, domácí tým, hostující tým nebo právě načtený zápas.
3. Doplnit název, volitelný text/claim a HTTPS odkaz. Nahrát hotový QR kód nebo logo, potom Přidat a uložit.
4. Vybrat vrstvu QR výzva nebo Partneři. Vybrat jednotlivou položku nebo střídání odpovídajících položek, interval 5–300 sekund a jeden ze čtyř rohů.

Organizační položky platí pro všechny zápasy dané organizace **v tomto vysílacím kanálu**. Týmové pouze pro vybraný tým; zápasové pouze pro přesné Game ID. Volba Oba týmy přidá partnery obou účastníků. Položky lze vypnout nebo odstranit; změna knihovny se projeví i v již otevřeném OBS kanálu. Není nutné znovu kopírovat URL.

Knihovna patří vysílacímu kanálu, není to zatím sdílená administrace všech organizací. Další operátor se ke stejné knihovně dostane soukromým ovládacím odkazem. Odkaz je tajný a umožňuje měnit vysílání. Samostatně vytvořený kanál má samostatnou knihovnu. Pozdější centrální knihovna organizace potřebuje přihlášení a organizační role.

Obrázky PNG/JPEG/WebP do 250 kB, nejvýše 4096 × 4096 px při nahrávání. V1 ukládá malé obrázky přímo s knihovnou do PostgreSQL, ne do Sheetu ani do repozitáře. Limit 16 položek a celkem 1,8 MB včetně jejich kódování. Při rozšíření na větší mediální knihovnu lze obrazová data přesunout do objektového úložiště bez změny přiřazení organizace/tým/zápas.

QR kód se negeneruje ani nepřepisuje podle zadaného odkazu. Je potřeba nahrát skutečný hotový kód a zachovat jeho bílý bezpečný okraj. Text a claim se vysílají tak, jak je operátor zadá; přepnutí CZ/EN překládá rozhraní a systémové popisky, nikoliv vlastní reklamní text.

## Další vrstvy

- **Přehled gólů:** každý gól má výraznější týmové logo, název týmu, barevné označení strany a dostupnou fotografii střelce. Nedostupná fotografie se nenahrazuje vymyšleným obličejem. Stránkování zůstává po osmi gólech.
- **Přesilovka / oslabení:** operátor vybere tým, který právě hraje přesilovku. Panel ukazuje jeho PP a pod ním soupeřovo PK, góly/příležitosti a procenta. Zapnutí je ruční přes společné Zobrazit/Skrýt v OBS; vrstva neodpočítává trest ani neurčuje sama aktuální počet hráčů.
- **Lídři týmu:** přepnout góly, asistence nebo body, vybrat tým. Top 5 má jméno, dostupnou fotografii, počet zápasů a týmový/sezonní kontext.
- **Příští zápasy:** až tři následující zápasy vybraného týmu z programu HMS, v okně 14 dnů od zvoleného utkání. Pokud je v okně méně zápasů, zobrazí jen dostupné. Časy jsou lokální, stejně jako v HMS. Zrušená/odložená utkání se nezvou.
- **Poslední výsledky:** posledních pět uložených výsledků a souhrn výher/remíz/proher v dostupném výběru.

Stále jde o **jednu vrstvu v daném kanálu**. PP, reklama a soupiska se nepřekrývají jako současné nezávislé výstupy. Pro souběžné zobrazení více grafik by následoval vícevrstvý mixér; V1 zachovává dosavadní bezpečné přepínání.

## Přesnost a dostupnost dat

Lídři, výsledky a historické PP/PK vycházejí z již importovaných dokončených zápasů přesné organizace, soutěže a sezony, před vybraným utkáním. Nezahrnují právě běžící zápas. Nejde automaticky o kompletní oficiální sezonní žebříček; pokrytí je uvedené přímo ve vrstvě. Při neúplném importu je potřeba nejprve doplnit historii přes stávající import, nikoli procenta dopočítávat z odhadu. Počítají se maximálně posledních 500 utkání obou týmů, dosažení limitu se označí.

PP/PK se zveřejní jen při podporovaných a konzistentních gólových i trestných událostech **ve všech zahrnutých uložených zápasech daného týmu**. Neznámý údaj je pomlčka a vysvětlení; nula příležitostí není 0% úspěšnost. Model nepodporuje všechny mechanismy překrývajících se trestů, proto může spolehlivé procento chybět i při dostupném výsledku zápasu.

Příští zápasy čtou program HMS. Historie a program mají nezávislou dostupnost: výpadek jednoho neschová druhý. Kontext se drží v krátké serverové cache 120 s, samotné události používají stávající aktualizace. Při nedostupném HMS ověření konkrétního zápasu se nová data cizí organizace ani demo nepoužijí jako náhrada.

## Technické oddělení preview

`VERCEL_ENV=production` používá dosavadní tabulku `broadcast_channels` a novou `broadcast_libraries`. Všechny ostatní prostředí (včetně chybějícího `VERCEL_ENV`) používají `broadcast_channels_preview` / `broadcast_libraries_preview`. `BROADCAST_SANDBOX=1` vynutí izolaci i při produkční hodnotě prostředí. Identifikátory tabulek jsou pevně vybrané serverem. Testovací kanály ani jejich knihovna se po mergi automaticky nepřenesou do produkce.

Zápis knihovny používá stejnou soukromou schopnost ovládání kanálu, hash klíče a vlastní revizi. Veřejný výstup může číst jen veřejná obrazová data/popisky, nikdy ovládací klíč. Revize knihovny obnoví existující výstup; nedochází k automatickému zapnutí skrytého kanálu. Produkční data historie se pouze čtou; import ani webhook se tímto rozšířením nemění.

## Kontrola před schválením

1. V galerii projít nové vrstvy, CZ/EN a všechny čtyři rohy. Vlastní QR zkusit telefonem při reálném rozlišení přenosu.
2. Na preview načíst reálný zápas, vytvořit testovací kanál, přidat QR a dva partnery. Ověřit střídání i po obnovení ovladače.
3. Přepínat vrstvy, domácí/hosté, Zobrazit/Skrýt. Adresa zdroje OBS se nemění.
4. U skutečných týmů zkontrolovat sezonu, soutěž a uvedené pokrytí importů. U PP/PK je legitimní nedostupnost při chybějících/nespolehlivých trestných událostech.
5. Ověřit původní úvodní vrstvu, soupisky, stav po třetinách, góly, insights a přepínání dnů.
6. Teprve po odsouhlasení mergovat PR. Po nasazení nahrát schválené obrázky do produkčního kanálu; preview kanál zůstává testovací.
