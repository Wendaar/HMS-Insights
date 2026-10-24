# Základ partnerských vrstev

Změna je zatím pouze na testovací větvi v PR #22. Produkci neslučovat bez schválení.

## Postup operátora

1. Načíst zápas ve skutečném Broadcast Studiu (`index.html`, nikoliv galerii `demo.html`).
2. Vytvořit nebo připojit svůj testovací OBS kanál. Jeho stálá adresa se používá pro obě partnerské vrstvy.
3. Vybrat **Partner v rohu** nebo **Velké partnerské oznámení**.
4. Jako zdroj ponechat **HMS · sponzoři vybraného týmu**. Vybrat tým podle názvu (domácí nebo hostující účastník zápasu).
5. V části **Výběr a pořadí partnerů** zaškrtnout partnery, šipkami změnit pořadí a uložit. Používají se jen skutečné vazby tým–sponzor z HMS. Nespojujeme organizace ani stejnojmenné týmy podle textu.
6. Vybrat konkrétního partnera, nebo **Střídat všechny odpovídající** a interval 5–300 sekund. U malé vrstvy vybrat roh, například vlevo dole.
7. Použít společné Zobrazit / Skrýt v OBS. Přepnutí vrstvy nebo jejího nastavení se přenáší stálou OBS adresou; skrytý kanál zůstává při úpravách skrytý.

**Partner v rohu:** kompaktní průhledná vrstva s logem, názvem, dostupným claimem a webem. **Velké partnerské oznámení:** celá plocha 1920 × 1080 s výrazným logem, názvem, claimem a webem. Chybějící logo/claim/web se nevymýšlí, jméno lze použít i bez obrázku. Obě varianty mohou držet jednoho partnera nebo střídat uložený seznam.

## Ukládání a hranice

- Výběr a pořadí se ukládají **pro tým a konkrétní vysílací kanál**, chráněné jeho soukromým ovládacím klíčem. Nejde zatím o globální organizační předvolbu pro všechny operátory. Obě velikosti používají stejný týmový seznam; právě zvolený jednotlivý partner, interval a roh patří stavu kanálu.
- V uložené knihovně je jen reference na UUID sponzora, týmu a organizace a příznak zapnutí. Názvy, loga, claimy a weby zůstávají v HMS a nevytvářejí se jejich další editovatelné kopie.
- Bez uloženého výběru se nabídnou přiřazení z HMS v pořadí zdroje. Vazba nevytváří kanál ani nezapíná výstup; grafikou stále řídí operátor. Pokud v uloženém seznamu vypne všechny partnery nebo je API nedostupné, partnerská vrstva je prázdná/průhledná.
- Nově přidaný partner do již uloženého seznamu není automaticky zapnutý. V ovladači se nabídne k ručnímu zařazení. Odebraná HMS týmová vazba přestane partnera do tohoto týmu pouštět.
- Obnovení partnerů z HMS probíhá v aktivním výstupu po 60 sekundách, s krátkou serverovou cache. V ovladači lze použít Obnovit z HMS.
- Původní vlastní obrázky a QR výzvy zůstávají ve vlastní knihovně kanálu. Ruční partneři jsou dostupní přes přepnutí zdroje, odděleně od HMS. Do jednoho kanálu lze uložit 16 obrazových položek a celkem 128 položek včetně malých HMS referencí, v limitu 1,8 MB.
- Přílohy z HMS nejsou součástí této implementace; používáme ověřené `logoUrls`. Po zpřístupnění příloh může následovat výběr fotografie/banneru/QR pro konkrétní formát.
- V1 zobrazuje jednu vrstvu v jednom kanálu. Velké oznámení nahradí malou vrstvu; současný vícevrstvý mixér ani automatický návrat po pevné době zatím nejsou součástí.

Galerie `demo.html` obsahuje obě velikosti na výslovně smyšlených datech; nic neukládá ani neřídí živý OBS kanál.
