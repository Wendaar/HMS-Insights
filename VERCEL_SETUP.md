# HMS Insights na Vercelu

Tento repozitář obsahuje veřejnou stránku i serverovou část. GitHub je zdrojový
kód; Vercel změny z GitHubu sestaví a spustí.

## Co už je připravené

- `GET /` a `GET /priklepy` — veřejný feed,
- `GET /api/feed` — veřejná očištěná data,
- `GET /api/health` — kontrola konfigurace bez zobrazení tajných hodnot,
- `POST /api/webhooks/hms/game-finished` — zabezpečený vstup pro HMS,
- PostgreSQL migrace v `db/migrations/`,
- Vercel Functions nastavené do Frankfurtu (`fra1`, AWS `eu-central-1`).

Projekt používá ve Vercelu preset `Other`, aby serverové funkce z adresáře
`api/` běžely samostatně vedle stávajícího statického webu.

## Datový tok

1. HMS pošle `POST` s `{ "type": "game.finished", "gameId": "..." }`.
2. Požadavek nese `Authorization: Bearer <HMS_WEBHOOK_SECRET>`.
3. Aplikace server-to-server stáhne Game Events a Lineup.
4. Stávající parser a pravidla vytvoří Příklepy.
5. Výsledky se idempotentně uloží do PostgreSQL.
6. Veřejný feed čte pouze view `public_priklepy_feed`.

Opakované doručení stejného zápasu je bezpečné: primární klíče a upsert stejné
záznamy aktualizují, nevytvoří duplikáty.

## Nastavení ve Vercelu

1. Importovat GitHub repozitář `Wendaar/HMS-Insights`.
2. Přes Marketplace založit PostgreSQL/Neon ve Frankfurtu.
3. V databázovém SQL editoru postupně spustit migrace `001`, `002`, `003`.
4. Ve Vercel Environment Variables nastavit hodnoty popsané v `.env.example`.
5. Pro první vizuální kontrolu lze dočasně nastavit `ALLOW_DEMO_FEED=true`.
6. Po připojení databáze a HMS tento přepínač odstranit.

Tajné hodnoty patří pouze do Vercelu. Nikdy se nevkládají do GitHubu, stránky,
URL ani veřejného JavaScriptu.

## Co musí doplnit Wootera

- tvar a dokumentaci obou read-only HMS endpointů,
- serverový API token,
- potvrzený formát a autentizaci `game.finished`,
- cílovou adresu webhooku pošleme po prvním nasazení.

Pokud bude skutečný HMS payload odlišný od současných reálných vzorků, upraví
se jen transportní adaptér a normalizace; pravidla Příklepů zůstávají oddělená.
