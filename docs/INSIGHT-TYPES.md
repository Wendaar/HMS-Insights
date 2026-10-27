# Katalog typů Příklepů

Tento soubor je společná smlouva pro vyhodnocovací engine, veřejný výběr,
archiv a `app.phmcup.cz/studio`. Databázový `type` je stabilní technický klíč;
texty a grafické názvy se mohou ladit bez přepočítání historických dat.

| Type | Český název | English name | Krátký headline pro Studio | Práh |
| --- | --- | --- | --- | --- |
| `BIG_WIN` | Vysoká výhra | Big win | BIG WIN | rozdíl nejméně 5 branek |
| `EARLY_GOAL` | Rychlý gól | Early goal | FAST GOAL | gól v první minutě |
| `MULTIPOINT_GAME` | Vícebodový zápas | Multi-point game | POINT NIGHT | nejméně 3 body |
| `HATTRICK` | Hattrick | Hat trick | HAT TRICK | nejméně 3 góly |
| `BIG_SAVES` | Brankářský výkon | Goalie performance | BIG SAVES | nejméně 30 zákroků |
| `TEAM_GOAL_MILESTONE` | Gólový milník týmu | Team goal milestone | DOUBLE DIGITS | 10., 20., 30. … gól týmu v zápase |
| `COMEBACK_WIN` | Velký obrat | Big comeback | COMEBACK | vítěz otočil ztrátu nejméně 4 branek |
| `SEASON_GOAL_MILESTONE` | Gólový milník sezony | Season goal milestone | GOAL MILESTONE | 10., 20., 30. … gól hráče v sezoně |
| `SEASON_POINT_MILESTONE` | Bodový milník sezony | Season point milestone | POINT MILESTONE | 10., 20., 30. … bod hráče v sezoně |
| `TEAM_WIN_STREAK` | Vítězná série | Winning streak | WIN STREAK | nejméně 4 výhry v řadě |
| `TEAM_UNBEATEN_STREAK` | Série bez porážky | Unbeaten streak | UNBEATEN | nejméně 5 zápasů bez porážky |
| `PLAYER_GOAL_STREAK` | Gólová série hráče | Player goal streak | ON FIRE | nejméně 4 zápasy s gólem v řadě |

## Pravidlo pro Studio

Nový uložený typ se objeví v obecném seznamu Insights, protože Studio čte
`public_priklepy_feed`. Za plně podporovaný se ale považuje až ve chvíli, kdy
má Studio současně:

- položku ve filtru typu momentu,
- český a anglický název a popis,
- krátký headline pro grafiku,
- formát hodnoty z `facts` (například číslo milníku nebo délku série),
- ověřenou kartu ve všech používaných poměrech stran.

Překvapení podle postavení v tabulce zatím v katalogu není. Nejdříve potřebuje
oficiální pořadí před konkrétním zápasem a pravidla bodování dané soutěže.
