# Veřejný přehled zápasů – experimentální vložení

Stávající stránky ani jejich původní pohled se tím nemění. Následující kód lze vložit do vlastního HTML bloku vedle současného rozpisu.

## PHM Cup

```html
<iframe
  src="https://app.phmcup.cz/games/phm/2026-2027?period=future&amp;embed=1"
  title="PHM Cup – rozpis a výsledky"
  width="100%" height="1000"
  style="border:0;display:block"
  loading="lazy">
</iframe>
```

## BNHLH

```html
<iframe
  src="https://public.heromanagementsystem.com/games/bnhlh/2026-2027?period=future&amp;embed=1"
  title="BNHLH – rozpis a výsledky"
  width="100%" height="1000"
  style="border:0;display:block"
  loading="lazy">
</iframe>
```

- `period=future` otevře všechny budoucí zápasy sezóny. `period=past` všechny minulé. Pro dnešek parametr vynechte.
- Výšku iframe lze přizpůsobit webu. Uvnitř se po dojetí dolů automaticky přidává dalších 20 zápasů; k dispozici je i tlačítko Načíst další zápasy.
- Hledání i filtry týmů/skupin procházejí celou vybranou část sezóny, včetně vzdálených termínů. Hledat lze také podle rozhodčího a časoměřiče.
- Přímý Game Report nebo původní detail HMS se z vloženého přehledu otevře v novém panelu.
- `lang=en` přepne angličtinu. `embed=1` zachová kompaktní prostor a odkazy pro vložený pohled.
- Povolené weby: `https://phmcup.cz`, `https://www.phmcup.cz`, `https://bnhlh.cz`, `https://www.bnhlh.cz`. Není potřeba přihlášení ani secret.

Pohled **Dnes** navíc automaticky obnovuje průběžné skóre po 30 sekundách. Rozehrané zápasy označuje zeleně jako Živě/Live. Skrytý panel nebo iframe obnovování pozastaví; ostatní pohledy se automaticky neobnovují. Při výpadku zůstává poslední skóre s upozorněním.

CMS iframe detection: a schedule compares its own window with the top window, without reading the parent DOM. Being inside a frame enables embedded report links automatically, even when the CMS omits `embed=1`. Reports open in a new tab with `noopener noreferrer`; standalone schedules retain same-tab navigation. The report framing policy remains unchanged. This also applies to rows updated by Today polling.
