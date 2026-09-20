# HMS Insights / Příklepy — MVP 0.1

Úzký vertical slice nad jedním dokončeným HMS zápasem:

`Game Events + Lineup → normalizace → zápasové statistiky → 5 pravidel → /priklepy`

## Spuštění

Požaduje pouze Node.js 20+; nejsou potřeba žádné balíčky třetích stran.

```bash
npm test
npm start
```

## Veřejná ukázka

Statická demonstrační verze pro GitHub Pages se vytvoří příkazem:

```bash
npm run build:static
```

Výstup je ve složce `docs/`. Neobsahuje žádné přístupové klíče ani hesla; jde o stejné ukázkové a očištěné údaje jako v místním náhledu.

Otevřete `http://localhost:3000/priklepy`.

## Import skutečného HMS response

```bash
node scripts/ingest.js cesta/game-events.json cesta/lineup.json
```

Přepínač `--persist` uloží výsledek přes Supabase REST. Nejdříve spusťte migraci
`db/migrations/001_mvp.sql` a nastavte `SUPABASE_URL` a
`SUPABASE_SERVICE_ROLE_KEY` pouze v lokálním prostředí. Klíč se nikdy neukládá
do repozitáře.

Pro opakovatelné vložení sanitizovaného testovacího zápasu lze vygenerovat SQL
příkazem `node scripts/seed-sql.js`.

## Hranice MVP

- Pravidla: `BIG_WIN`, `EARLY_GOAL`, `MULTIPOINT_GAME`, `HATTRICK`, `BIG_SAVES`.
- HMS adaptér, doménová pravidla a Supabase úložiště jsou oddělené moduly.
- Testovací fixture je odvozená z reálného zápasu, ale obsahuje jen analytické
  minimum. Neobsahuje telefon, e-mail, datum narození ani jiné nepotřebné údaje.
- Supabase je pouze vyměnitelný prototypovací adaptér nad přenositelným SQL
  modelem.
