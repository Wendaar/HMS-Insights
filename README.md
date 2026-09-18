# HMS Insights / Příklepy — MVP 0.1

Úzký vertical slice nad jedním dokončeným HMS zápasem:

`Game Events + Lineup → normalizace → zápasové statistiky → 5 pravidel → /priklepy`

## Spuštění

Požaduje pouze Node.js 20+; nejsou potřeba žádné balíčky třetích stran.

```bash
npm test
npm start
```

Otevřete `http://localhost:3000/priklepy`.

## Import skutečného HMS response

```bash
node scripts/ingest.js cesta/game-events.json cesta/lineup.json
```

Přepínač `--persist` uloží výsledek přes Supabase REST. Nejdříve spusťte migraci
`db/migrations/001_mvp.sql` a nastavte `SUPABASE_URL` a
`SUPABASE_SERVICE_ROLE_KEY` pouze v lokálním prostředí. Klíč se nikdy neukládá
do repozitáře.

## Hranice MVP

- Pravidla: `BIG_WIN`, `EARLY_GOAL`, `MULTIPOINT_GAME`, `HATTRICK`, `BIG_SAVES`.
- HMS adaptér, doménová pravidla a Supabase úložiště jsou oddělené moduly.
- Testovací fixture je odvozená z reálného zápasu, ale obsahuje jen analytické
  minimum. Neobsahuje telefon, e-mail, datum narození ani jiné nepotřebné údaje.
- Supabase je pouze vyměnitelný prototypovací adaptér nad přenositelným SQL
  modelem.

