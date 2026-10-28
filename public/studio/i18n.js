// Shared presentation vocabulary for the editor and exported PNGs.
// Sporting names and user-entered text are never translated or transliterated.
export let language='cs';
export const supportedLanguages=['cs','en'];
export function normalizeLanguage(value){return supportedLanguages.includes(value)?value:'cs';}
export function setLanguage(value){language=normalizeLanguage(value);return language;}
export const english={
'Organizace':'Organization','MVP 1.0 · interní test':'MVP 1.0 · prototype',
'OD ZÁPASU KE GRAFICE':'FROM GAME TO GRAPHIC','Velké momenty.':'Big moments.','Za pár kliknutí.':'Just a few clicks away.',
'Vyberte zápas nebo Příklep. Připravte grafiku a stáhněte ji rovnou na stadioně.':'Choose a game or an Insight. Create a graphic and download it right at the rink.',
'Zdroj':'Source','Hledat hráče, tým nebo zápas':'Find a player, team or game','např. Kuracina, Berkut…':'e.g. Kuracina, Berkut…','Typ výkonu':'Achievement type','Všechny výkony':'All achievements','Více bodů':'Multiple points','Výkon brankáře':'Goaltender performance','Rychlý gól':'Early goal','Výrazná výhra':'Big win',
'← Předchozí':'← Previous','Další →':'Next →','← Bližší období':'← More recent window','Dalších 30 dnů →':'Next 30 days →',
'Knihovna Insights používá existující uložené Příklepy. Refresh pouze čte HMS a obnoví dočasnou cache.':'The Insights library uses existing saved achievements. Refresh only reads HMS and updates the temporary cache.',
'VÁŠ VÝSTUP':'YOUR GRAPHIC','Vyberte zápas':'Choose a game','Vyberte výkon':'Choose an achievement',
'Nastavení editoru se ukládá v tomto zařízení zvlášť pro organizaci a každý typ grafiky.':'Editor settings are saved on this device separately for each organization and graphic type.',
'Náhled grafiky':'Graphic preview','Ochranná zóna':'Safe area','Váš další velký moment':'Your next big moment','začíná výběrem zápasu':'starts with a game',
'Vizuální styl':'Visual style','Clean · čistý sportovní':'Clean · sports','Crazy · oslavný':'Crazy · celebration','Artistic · velkolepý oslavný':'Artistic · grand celebration','Technical · dramatický':'Technical · dramatic','Pantha · výrazný sportovní':'Pantha · bold sports',
'Zobrazit ochranné linie':'Show safe area guides','Obsah respektuje ochrannou zónu i v PNG. Čáry se neexportují; rozhraní jednotlivých sítí se může lišit.':'PNG content stays inside the safe area. Guides are not exported; each social platform may place its controls differently.',
'Šablona':'Template','Formát':'Format','Font jmen a popisů':'Names and captions font',
'Pantha má pouze velká anglická písmena. České texty při jejím výběru používají Hitch Grotesk se zachovanou diakritikou.':'Pantha supports uppercase English letters only. Unsupported text uses Hitch Grotesk or Noto Sans, preserving all accents.',
'Pantha · anglické titulky':'Pantha · English headlines','Vlastní fotografie tohoto hráče':'Upload this player’s photo','Použít fotografii z HMS':'Use HMS photo','Loga soutěže a skupiny':'Competition and group logos',
'Automaticky z HMS; vlastní doplnění platí lokálně pro vybranou soutěž/skupinu.':'Automatic from HMS; overrides apply locally to the selected competition/group.',
'Doplnit logo soutěže':'Upload competition logo','Doplnit logo skupiny':'Upload group logo','Použít loga z HMS':'Use HMS logos','Barva pozadí':'Background color','Akcent':'Accent','Barva bloků':'Panel color','Krytí bloků · 0 % průhledné / 100 % plné':'Panel opacity · 0% transparent / 100% solid',
'Zesvětlení / ztmavení':'Lighten / darken','Vlastní pozadí':'Upload background','nebo veřejná HTTPS URL':'or a public HTTPS URL','Odebrat pozadí':'Remove background','Partner · textový prefix':'Partner · text prefix','např. ODIN':'e.g. ODIN','Logo partnera · HTTPS URL':'Partner logo · HTTPS URL','nebo nahrát logo':'or upload a logo','Odebrat logo partnera':'Remove partner logo','↓ Stáhnout PNG':'↓ Download PNG','Sdílet…':'Share…',
'Všechny styly používají stejná ověřená data. Fotografie a tým hráče se vážou ke konkrétnímu zápasu; chybějící fotografie lze doplnit ručně.':'All styles use the same verified data. Player photos and teams belong to the selected game; missing photos can be uploaded.',
'Logo je použité, ale úložiště zařízení je plné.':'Logo applied, but device storage is full.','Nastavení je použité. Úložiště zařízení je plné, nelze je uložit.':'Settings applied, but device storage is full and they could not be saved.',
'Ukončeno':'Finished','Probíhá · průběžná data':'In progress · provisional data','Naplánováno':'Scheduled','Neznámý stav':'Unknown status','Načítám…':'Loading…','Načtení se nezdařilo.':'Could not load data.',
'Knihovna odehraných zápasů · nejnovější první':'Completed games library · newest first',
'Pouze importované zápasy. Živý seznam HMS není v tomto nasazení připojen; dnešní a plánované zápasy mohou chybět.':'Imported games only. The live HMS list is not connected in this deployment; today’s and scheduled games may be missing.',
'Živý seznam HMS · Studio neomezuje stav zápasu.':'Live HMS list · Studio includes all game states.','Zdroj seznamu není potvrzen.':'List source is unconfirmed.','Týmový výkon':'Team achievement','Názvy týmů nejsou dostupné · {id}':'Team names unavailable · {id}',
'Žádné výkony neodpovídají hledání.':'No achievements match your search.',
'V uložených importech nejsou pro období {from} – {to} žádné zápasy. To neznamená, že v HMS nejsou naplánované.':'No imported games for {from} – {to}. Games may still be scheduled in HMS.',
'HMS pro období {from} – {to} nevrátilo žádné zápasy.':'HMS returned no games for {from} – {to}.',
'Data nejsou připojena nebo zdroj neodpovídá organizaci.':'Data is not connected or the source does not match this organization.',
'Načítám ověřená data zápasu…':'Loading verified game data…','Neověřený tým':'Unverified team',
'{competition} · {group}. Automaticky z HMS; doplnění se ukládá jen v tomto zařízení pro danou soutěž/skupinu.':'{competition} · {group}. Automatic from HMS; overrides are saved only on this device for this competition/group.',
'Skóre po třetině je průběžné, pouze z ověřených událostí.':'Period scores are provisional, based only on verified events.',
'Šablony výsledku čekají na dokončení zápasu nebo ověřená skóre třetin.':'Result templates require a finished game or verified period scores.',
'Uložená data HMS':'Stored HMS data','Obnoveno z HMS':'Refreshed from HMS','Testovací data':'Test data','načteno':'loaded',
'Uložený výkon nebo oficiální hvězda HMS. Fotografie a tým patří k hráči v tomto zápase.':'Saved achievement or official HMS star. Photo and team belong to this player in this game.',
'Zápas je naplánovaný. Zpětné grafiky budou dostupné po ukončení.':'This game is scheduled. Retrospective graphics will be available after it finishes.',
'Zápas probíhá. Konec třetiny vyžaduje ověřenou ukončenou třetinu; zpětné grafiky čekají na ukončení zápasu.':'Game in progress. End of Period requires a verified completed period; retrospective graphics require a finished game.',
'Pro tento stav zápasu není výstup dostupný.':'No graphic is available for this game state.','PNG se nepodařilo vytvořit.':'Could not create the PNG.','Export čeká na opravu obrázku.':'Fix the image to continue exporting.',
'Použijte veřejnou HTTPS URL bez přihlašovacích údajů.':'Use a public HTTPS URL without credentials.','Nahrajte PNG/JPG/WebP do 8 MB.':'Upload a PNG/JPG/WebP up to 8 MB.','Obrázek se nepodařilo otevřít nebo uložit.':'Could not open or save this image.','Sdílení není dostupné. Použijte Stáhnout PNG.':'Sharing is unavailable. Use Download PNG.',
'Organizace není v tomto Studiu dostupná.':'This organization is not available in this Studio.','Nepřipojeno':'Not connected','Seznam organizací nelze načíst. Zkuste stránku obnovit.':'Could not load organizations. Please reload the page.',
'KONEČNÝ VÝSLEDEK':'FINAL SCORE','PO {period}. TŘETINĚ':'END OF PERIOD {period}','PO {period}. ČÁSTI':'END OF PERIOD {period}','Oficiální hvězda zápasu dle HMS.':'Official star of the match from HMS.',
'GÓLY':'GOALS','ZÁKROKŮ':'SAVES','BODY':'POINTS','PŘINÁŠÍ':'PRESENTS','FOTOGRAFIE':'PHOTO','NENÍ K DISPOZICI':'UNAVAILABLE','Tým nelze ověřit':'Team could not be verified',
'Použijte veřejnou HTTPS adresu obrázku.':'Use a public HTTPS image URL.','Obrázek nelze načíst (CORS, formát nebo velikost). Nahrajte PNG/JPG/WebP do 8 MB.':'Image could not be loaded (CORS, format or size). Upload a PNG/JPG/WebP up to 8 MB.','Font se nepodařilo načíst. Obnovte stránku a zkuste export znovu.':'Font failed to load. Reload the page and try exporting again.',
'Logo domácích':'Home team logo','Logo hostů':'Away team logo','Logo organizace':'Organization logo','Logo soutěže':'Competition logo','Logo skupiny':'Group logo','Logo fáze':'Phase logo','Fotografie hráče':'Player photo','Logo týmu hráče':'Player’s team logo','{asset} se nepodařilo načíst.':'Could not load {asset}.',
'Fotografie hráče není dostupná. Můžete nahrát vlastní pro tento konkrétní výkon.':'Player photo unavailable. You can upload one for this achievement.',
'Vazbu hráče/týmu nelze plně ověřit; žádný náhradní domácí tým se nepoužívá.':'Player/team identity could not be fully verified; no substitute home team is used.',
};
export function t(source,values={},lang=language){
  const text=normalizeLanguage(lang)==='en'?(english[source]??source):source;
  return text.replace(/\{([a-zA-Z]+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]):match);
}
export function translateDocument(root=document){
  const walker=root.createTreeWalker(root.body,4);let node;
  while((node=walker.nextNode())){if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;const text=node.textContent.trim();if(text&&english[text])node.textContent=node.textContent.replace(text,t(text));}
  for(const element of root.querySelectorAll('[placeholder],[aria-label]'))for(const attr of ['placeholder','aria-label'])if(element.hasAttribute(attr))element.setAttribute(attr,t(element.getAttribute(attr)));
  root.documentElement.lang=language;
}
export function filterLabel(value,lang=language){return normalizeLanguage(lang)==='en'?value:({Today:'Dnes',Yesterday:'Včera',Tomorrow:'Zítra','-7 days':'−7 dnů','+7 days':'+7 dnů',Past:'Minulost',Future:'Budoucnost'}[value]??value);}
// English descriptions reuse existing achievement types and verified counters.
// No new achievement detection and no guessed player stats or event times.
export function insightDescription(insight,subject=null,lang=language){
  if(normalizeLanguage(lang)!=='en')return insight?.text??'';
  const stats={...(insight?.facts??{}),...(insight?.stats??{}),...(subject?.facts??{}),...(subject?.stats??{})};
  const pair={HATTRICK:['goals','goals'],MULTIPOINT_GAME:['points','points'],BIG_SAVES:['saves','saves'],TEAM_GOAL_MILESTONE:['milestone','team goals'],COMEBACK_WIN:['largestDeficit','goals down'],SEASON_GOAL_MILESTONE:['milestone','season goals'],SEASON_POINT_MILESTONE:['milestone','season points'],TEAM_WIN_STREAK:['streak','consecutive wins'],TEAM_UNBEATEN_STREAK:['streak','games unbeaten'],PLAYER_GOAL_STREAK:['streak','games with a goal'],RANK_UPSET:['rankDifference','places higher']}[insight?.type];
  if(pair&&Number.isFinite(stats[pair[0]]))return `${stats[pair[0]]} ${pair[1]}.`;
  return ({HATTRICK:'Hattrick performance.',MULTIPOINT_GAME:'Multi-point performance.',BIG_SAVES:'Outstanding goaltender performance.',EARLY_GOAL:'Early goal.',BIG_WIN:'Big team win.',TEAM_GOAL_MILESTONE:'Team scoring milestone.',COMEBACK_WIN:'Big comeback win.',SEASON_GOAL_MILESTONE:'Season goal milestone.',SEASON_POINT_MILESTONE:'Season point milestone.',TEAM_WIN_STREAK:'Team winning streak.',TEAM_UNBEATEN_STREAK:'Team unbeaten streak.',PLAYER_GOAL_STREAK:'Player scoring streak.',RANK_UPSET:'A lower-ranked team defeated a higher-ranked opponent.',OFFICIAL_STAR:'Official star of the match from HMS.'}[insight?.type]??insight?.text??'');
}
export function insightTitle(insight,lang=language){return normalizeLanguage(lang)==='en'?({HATTRICK:'Hattrick',MULTIPOINT_GAME:'Multi-point game',BIG_SAVES:'Goaltender performance',EARLY_GOAL:'Early goal',BIG_WIN:'Big win',TEAM_GOAL_MILESTONE:'Team goal milestone',COMEBACK_WIN:'Big comeback',SEASON_GOAL_MILESTONE:'Season goal milestone',SEASON_POINT_MILESTONE:'Season point milestone',TEAM_WIN_STREAK:'Winning streak',TEAM_UNBEATEN_STREAK:'Unbeaten streak',PLAYER_GOAL_STREAK:'Goal streak',RANK_UPSET:'Upset alert',OFFICIAL_STAR:'Star of the Match'}[insight?.type]??insight?.title??'Insight'):(insight?.title??'Insight');}
