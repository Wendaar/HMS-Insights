# Sponzoři HMS a konfigurace vysílání

## Ověřený stav 25. 10. 2026

Čtecí integrační endpoint `GET /api/v1/sponsors` funguje s existujícími organizačními klíči. V testovacím nasazení jsme skutečně načetli:

- PHM: 7 sponzorů včetně názvů, log, claimu a webu tam, kde jsou vyplněné.
- EUCHL: prázdný seznam sponzorů, ale úspěšné načtení čtyř týmů. Prázdný seznam není chyba spojení; může odpovídat dosud nevyplněné evidenci.
- Přiřazení PHM: PLATIDLO.COM → Prague Hockey Masters, GNB Chem, Škoda Icerink. Fanklub Lev Praha → Prague Hockey Masters. Potvrzeno tedy více sponzorů u týmu i jeden sponzor u více týmů.

Odpověď sponzora obsahuje `sponsorId`, `name`, `nick`, `short`, `claim`, `web`, `logoUrls`, `teamIds`, `competitionIds`, `seasonIds`, `groupIds`, `phaseIds`, `venueIds`. Týmové vztahy jsou skutečně v `teamIds` sponzora; `/teams` v ověřené odpovědi pole Sponsors neposílá. Existenci dalších polí jsme potvrdili, nikoli naplnění každého druhu vazby.

Čtecí adaptér v testovací větvi: `/api/broadcast?org=PHM&catalog=sponsors`. Přehled pro člověka: `/broadcast/sponsors.html?org=PHM`. Klíč nikdy neopustí server, organizace se ověřuje proti odpovědi `/organization`. Katalog nezapisuje do HMS ani do OBS. Serverová cache je 60 sekund.

## Rozdělení správy

**HMS zůstává zdrojem evidence:** sponzor, logo, web, základní claim a věcné vazby na týmy/soutěže/sezony/skupiny/fáze/stadiony. Identitou je UUID sponzora v konkrétní organizaci; nepárujeme podle názvu a nekopírujeme loga jako nový ruční záznam.

**Studio bude spravovat vysílací pravidla:** pro kterou vrstvu je sponzor zapnutý, v jakém pořadí, jak dlouho, kde v obraze a případné textové varianty CZ/EN. Zápasová jednorázová výjimka může omezit pravidlo na Game ID. Nepřepisuje základní vztah sponzor–tým v HMS. `gameIds` se v ověřeném seznamu nevyskytuje, proto takovou HMS vazbu nepředpokládáme.

Navržená tabulka pravidel:

| Organizace | Sponzor z HMS | Platnost | Tým / soutěž / zápas | Vrstva | Zapnuto | Pořadí | Doba | Pozice |
|---|---|---|---|---|---|---|---|---|
| PHM | GNB Chem | Převzít přiřazení HMS | PLATIDLO.COM | Partneři | Ano | 1 | 10 s | Vpravo dole |
| PHM | Škoda Icerink | Převzít přiřazení HMS | PLATIDLO.COM | Partneři | Ano | 2 | 10 s | Vpravo dole |
| PHM | Prague Hockey Masters | Převzít přiřazení HMS | PLATIDLO.COM, Fanklub Lev Praha | Před zápasem | Ano | 3 | 15 s | Vlevo dole |

Řádky jsou návrh vysílacích pravidel, nikoli nově uložené konfigurace. Stejný sponzor může mít různá pravidla pro různé vrstvy a organizace. Vazba v HMS sama o sobě nikoho nezapne do vysílání. Prázdná pole vazeb neznamenají automaticky „partner všech týmů“; organizační platnost musí být výslovná volba operátora.

QR výzvy na sociální sítě/program/web se povedou jako vlastní typ obsahu se stejnou platností, protože nemusí patřit sponzorovi. Volitelná QR výzva konkrétního sponzora se může odkazovat na jeho HMS UUID. Vlastní QR obrázek a obsah kódu se nezaměňují za logo a web sponzora.

## Co je a není hotové

Hotové je ověření živého API, serverový čtecí adaptér s oddělením organizací a tabulkový přehled existujících sponzorů a vazeb. `demo.html` je pouze galerie se smyšlenými daty; změny se neukládají ani nepřenášejí do Studia. Dosavadní ruční knihovna OBS kanálu se automaticky nepřevádí na HMS sponzory.

Editovatelná matice pravidel a její propojení s přehráváním partnerů je další implementační krok. Sdílená organizační konfigurace potřebuje oprávnění správce organizace; samotná veřejná OBS adresa ani veřejný katalog nesmí umožnit zápis. Do té doby lze využít existující chráněné ovládání kanálu pro pravidla daného vysílání. Produkce zůstává beze změny a PR #22 zůstává předmětem schválení.

Aktualizace: základní výběr a pořadí týmových partnerů už je propojený se dvěma vysílacími velikostmi. Viz [partnerské vrstvy](broadcast-partner-layers.md). Rozšířená matice pravidel podle jednotlivých vrstev a sdílená organizační správa zůstává dalším krokem.
