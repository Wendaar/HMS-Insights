// Presentation only: stored HMS data, names and the public JSON contract stay intact.
export function reportLanguage(value, summary = {}) {
  if (value === 'en' || value === 'cs') return value;
  return /\bEUCHL\b|European Union College Hockey League/i.test([summary.competition, summary.group].filter(Boolean).join(' ')) ? 'en' : 'cs';
}
export const reportLocale = lang => lang === 'en' ? 'en-GB' : 'cs-CZ';
const en = {
  'Přehled zápasů':'Games',
  'Část zákroků týmu není přiřazena konkrétnímu brankáři. Zobrazené zákroky jsou pouze přiřazené; individuální úspěšnost proto neuvádíme.':'Some team saves are not assigned to a goaltender. Only attributed saves are shown here; individual save percentage is therefore omitted.',
  'Hlavní navigace':'Main navigation', 'Příklepy':'Highlights',
  'Lokální testovací náhled z veřejného zápisu HMS. Nejde o nový import do databáze.':'Local preview using the public HMS game sheet. No new database import has been made.',
  'VYBRÁNO V HMS':'SELECTED IN HMS', 'Hvězdy zápasu':'Stars of the game', 'Předchozí hvězdy':'Previous stars', 'Další hvězdy':'Next stars',
  'TVÁŘE ZÁPASU':'GAME SPOTLIGHT', 'Lídři bodování zápasu':'Game scoring leaders', 'Nejproduktivnější hráč každého týmu':'Top scorer from each team',
  'PRŮBĚH ZÁPASU':'PLAY BY PLAY', 'Časová osa zápasu':'Game timeline', 'MOMENTY ZÁPASU':'GAME HIGHLIGHTS',
  'V tomto zápase zatím nejsou žádné Příklepy.':'No highlights are available for this game yet.',
  'Zdroj: HMS · Aktualizace dat:':'Source: HMS · Data updated:', 'neuvedena':'not available',
  'Výsledek vychází z uloženého výsledku HMS. Statistiky a průběh vycházejí z evidovaných událostí a mohou být neúplné.':'The score is the recorded HMS result. Statistics and play by play are based on recorded events and may be incomplete.',
  'Data zápasu (JSON)':'Game data (JSON)', 'HRÁČSKÁ KARTA':'PLAYER PROFILE', 'Zavřít kartu hráče':'Close player profile',
  'Logo skupiny soutěže':'Competition group logo', 'Logo stadionu':'Venue logo', 'DOMÁCÍ':'HOME', 'HOSTÉ':'AWAY', 'KONEČNÝ VÝSLEDEK':'FINAL',
  'střel ze zápisu':'recorded shots', 'Sekce zápasu':'Game sections', 'Přehled':'Summary', 'Průběh zápasu':'Play by play', 'Mapa gólů':'Goal maps', 'Sestavy a body':'Rosters and scoring',
  'GÓLY':'GOALS', 'ASISTENCE':'ASSISTS', 'BODY':'POINTS', 'Statistiky v soutěži':'League statistics',
  'Přehled týmových statistik':'Team statistics overview', 'Záznam zápasu':'Game broadcast', 'Otevřít na YouTube':'Watch on YouTube',
  'KONEČNÝ STAV':'FINAL SCORE', 'Po třetinách':'Linescore', 'Tým proti týmu':'Team comparison', 'Střely ze zápisu':'Recorded shots',
  'Vhazování %':'Face-off %', 'Přesilovky %':'Power play %', 'Oslabení %':'Penalty kill %', 'Trestné minuty':'Penalty minutes', 'Z evidovaného zápisu HMS.':'From the recorded HMS game sheet.',
  'Průběh zápasu bude dostupný po načtení zápisu.':'Play by play will be available after importing the game sheet.',
  'Průběžné skóre není k dispozici: evidované góly nepotvrzují celý výsledek.':'The running score is unavailable: recorded goals do not account for the full result.',
  'Události řadíme podle času zápisu v jednotlivých částech. Čas zápisu nenahrazuje herní čas; průběžné skóre při neúplném časování neuvádíme.':'Events are ordered by recording time within each period. Recording time is not game time; the running score is omitted when timing is incomplete.',
  'U některých gólů nelze určit přesné pořadí. Průběžné skóre neuvádíme.':'The order of some goals cannot be confirmed. The running score is omitted.',
  'Další události bez úplného času jsou na konci osy.':'Other events with incomplete timing appear at the end of the timeline.',
  'V načteném zápisu nejsou góly ani tresty.':'The imported game sheet has no goals or penalties.',
  'Tým':'Team', 'Oba týmy':'Both teams', 'Část zápasu':'Period', 'Celý zápas':'Full game', 'Další události':'Other events', 'Události':'Events', 'Góly a tresty':'Goals and penalties',
  'Góly':'Goals', 'Tresty':'Penalties', 'Zákroky':'Saves', 'Posunout události doleva':'Scroll events left', 'Posunout události doprava':'Scroll events right',
  'Vodorovná časová osa zápasu':'Horizontal game timeline', 'Detail události':'Event details', 'Zápis HMS':'HMS record', 'Dopočteno z průběhu trestů':'Inferred from recorded penalties',
  'GÓL':'GOAL', 'TREST':'PENALTY', 'ZÁKROK':'SAVE', 'Gól':'Goal', 'Trest':'Penalty', 'Zákrok':'Save',
  'Tomuto výběru neodpovídá žádná událost.':'No events match these filters.', 'Zrušit výběr zóny':'Clear zone selection', 'Zavřít detail události':'Close event details',
  'Odkaz na událost':'Link to event', 'Textový průběh zápasu':'Text play by play', 'TÝM PROTI TÝMU':'TEAM COMPARISON', 'CELÝ ZÁPAS':'FULL GAME',
  'Přesilovky a oslabení':'Special teams', 'Týmové srovnání bude dostupné po načtení úplného průběhu zápasu.':'Team comparisons will be available after importing the complete play by play.',
  'PP góly:':'PP goals:', 'Inkasované PP góly:':'PP goals against:', 'přesilovky:':'power plays:', 'oslabení:':'penalty kills:',
  'Úspěšnost oslabení · PK':'Penalty kill efficiency · PK', 'Využití přesilovek · PP':'Power play efficiency · PP', 'Vyrovnaně':'Even strength', 'Přesilovka':'Power play', 'Oslabení':'Shorthanded',
  'Klikněte na počet gólů pro střelce a detaily.':'Select a goal count to see scorers and details.',
  'Úspěšnost dopočtená z evidovaných krátkých trestů; souběžné stejné tresty se nepočítají jako přesilovka.':'Efficiency is calculated from recorded minor penalties; matching coincidental penalties do not create a power play.',
  'Procenta zobrazíme, když zápis umožní spolehlivě určit počet přesilovek a oslabení.':'Percentages are shown when the game sheet reliably identifies power play and penalty kill opportunities.',
  'Zápis HMS má přednost při určení typu gólu.':'The recorded HMS goal type takes precedence.',
  'DOMÁCÍ BRANKA':'HOME NET', 'BRANKA HOSTŮ':'AWAY NET', 'MAPA ZÁPASU':'GAME MAP', 'Odkud padly góly':'Goal origins', 'BRANKÁŘI A UMÍSTĚNÍ GÓLŮ':'GOALTENDERS AND GOAL PLACEMENT', 'Kam padly góly':'Goal placement',
  'Čísla označují pořadí gólů, × počet sloučených gólů. Značky jsou rozmístěné uvnitř zón podle zápisu.':'Numbers identify goals; × indicates grouped goals. Markers are placed within recorded zones, not at measured coordinates.',
  'Pohled na branku od střelce. Úspěšnost brankářů vychází z evidovaných zákroků a inkasovaných gólů.':'The net is viewed from the shooter’s perspective. Save percentage uses recorded saves and goals against.',
  'Úspěšnost zákroků':'Save percentage', 'Inkasované góly':'Goals against', 'Místa vstřelených gólů':'Goal origins', 'Umístění gólů v brance':'Goal placement', 'Neurčeno':'Unspecified',
  'HRÁČI ZÁPASU':'GAME ROSTERS', 'Kanadské bodování':'Player scoring', 'Klikněte na hráče pro statistiky v soutěži':'Select a player for league statistics', 'Hráč':'Player',
  'G góly · A asistence · B body · TM trestné minuty':'G goals · A assists · P points · PIM penalty minutes', 'B':'P', 'TM':'PIM',
  'Čas zápisu':'Recorded at', 'Skóre po gólu':'Score after goal', 'Asistence':'Assists', 'Brankář':'Goaltender', 'Střela':'Shot', 'Provedení':'Goal subtype', 'Odkud':'Origin', 'Kam':'Target', 'Početní situace':'Strength',
  '5 na 5 dle průběhu: v evidenci v tuto chvíli neběží trest.':'Inferred 5 on 5: no recorded penalty is active at this time.', 'Početní situace doplněná podle průběhu trestů.':'Strength inferred from the recorded penalty timeline.',
  'Délka trestu':'Penalty duration', 'Typ trestu':'Penalty type', 'Přestupek':'Infraction', 'VYBRANÉ GÓLY':'SELECTED GOALS', 'Vyberte gól pro detail':'Select a goal for details',
  'Načítání statistik…':'Loading statistics…', 'Souhrnné statistiky tohoto hráče zatím nejsou k dispozici.':'Aggregate statistics for this player are not available yet.',
  'Zápasy':'Games played', 'Úspěšnost %':'Save %', 'Čistá konta':'Shutouts', 'Výhry':'Wins', 'Remízy':'Ties', 'Prohry':'Losses', 'Body':'Points', 'PP góly':'PP goals', 'SH góly':'SH goals', 'Hvězda zápasu':'Star of the game',
  'LÍDR BODOVÁNÍ':'SCORING LEADER', 'TOP 10 BODOVÁNÍ':'TOP 10 SCORER', 'V této skupině soutěže':'In this competition group',
  'Souhrnné statistiky HMS pro tuto skupinu soutěže.':'HMS aggregate statistics for this competition group.', 'Součet z dosud načtených zápasů v této skupině soutěže.':'Totals from games imported so far in this competition group.',
  'Statistiky se nyní nepodařilo načíst. Zkuste kartu otevřít znovu.':'Statistics could not be loaded. Please open the profile again.',
  '★ HVĚZDA ZÁPASU':'★ STAR OF THE GAME', 'ÚSPĚŠNOST %':'SAVE %', 'ZÁKROKY':'SAVES', 'INKASOVANÉ':'GOALS AGAINST', 'HRÁČŮ V POLI':'SKATERS', 'BRANKÁŘŮ':'GOALTENDERS',
  'Lídr bodování této skupiny soutěže':'Scoring leader in this competition group', 'Záznam zápasu na YouTube':'Game broadcast on YouTube',
  'Levý roh':'Left corner', 'Za brankou':'Behind the net', 'Pravý roh':'Right corner', 'Levý kruh':'Left circle', 'Mezi kruhy':'Between the circles', 'Pravý kruh':'Right circle',
  'Levá modrá':'Left blue line', 'Střed modré':'Centre blue line', 'Pravá modrá':'Right blue line', 'Levý střed':'Left neutral zone', 'Střední pásmo':'Centre neutral zone', 'Pravý střed':'Right neutral zone',
  'Vlevo v obraně':'Left defensive zone', 'Střed obrany':'Centre defensive zone', 'Vpravo v obraně':'Right defensive zone',
  'Vlevo nahoře':'Top left', 'Pod víko':'Top shelf', 'Vpravo nahoře':'Top right', 'Levá strana':'Left side', 'Střed':'Middle', 'Pravá strana':'Right side', 'Vlevo dole':'Bottom left', 'Mezi betony':'Five-hole', 'Vpravo dole':'Bottom right',
  'Dorážka':'Rebound', 'Tečovaná střela':'Deflection', 'Příklep':'Slap shot', 'Střela zápěstím':'Wrist shot', 'Bekhend':'Backhand', 'Střela z první':'One-timer', 'Individuální':'Individual play', 'Kombinace':'Combination', 'Vlastní gól':'Own goal', 'Trestné střílení':'Penalty shot',
  'Menší trest':'Minor penalty', 'Větší trest':'Major penalty', 'Osobní trest':'Misconduct', 'Podražení':'Tripping', 'Hákování':'Hooking', 'Držení':'Holding', 'Nedovolené bránění':'Interference', 'Sekání':'Slashing', 'Vysoká hůl':'High-sticking', 'Hrubost':'Roughing', 'Napadení':'Charging', 'Krosček':'Cross-checking',
  'Základní část':'Regular season', 'Prodloužení':'Overtime', 'Samostatné nájezdy':'Shootout', 'Rychlý zásah':'Early goal', 'Výhra o šest':'Big win', 'Hattrick':'Hat trick',
  'Neplatné gameId.':'Invalid gameId.', 'Zápas zatím není importován.':'This game has not been imported yet.', 'Data zápasu jsou dočasně nedostupná.':'Game data is temporarily unavailable.',
};
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrases = new RegExp(`(?<![\\p{L}])(?:${Object.keys(en).sort((a,b)=>b.length-a.length).map(escapeRegex).join('|')})(?![\\p{L}])`, 'gu');
export function reportText(value, lang = 'cs') {
  const text = String(value ?? '');
  if (lang !== 'en') return text;
  return text.replace(phrases, match => en[match])
    .replace(/Výhra o (\d+) gólů/g, 'Win by $1 goals')
    .replace(/(\d+)\. (?:třetina|část)/g, 'Period $1')
    .replace(/(\d+) na (\d+)/g, '$1 on $2')
    .replace(/(\d+) událostí/g, '$1 events')
    .replace(/(\d+) góly|([0-9]+) gólů/g, (_,a,b)=>`${a??b} goals`)
    .replace(/(\d+) body v zápase/g, '$1-point game')
    .replace(/(\d+) zákroků/g, '$1 saves')
    .replace(/zvítězilo rozdílem (\d+) branek\./g, 'won by $1 goals.')
    .replace(/skóroval už v čase ([\d:]+)\./g, 'scored early at $1.')
    .replace(/zaznamenal (\d+) body/g, 'recorded $1 points')
    .replace(/vstřelil (\d+) (?:góly|goals)\./g, 'scored $1 goals.')
    .replace(/zaznamenal (\d+) (?:zákroků|saves)\./g, 'made $1 saves.')
    .replace(/v bodování této skupiny soutěže/g, 'in this competition group’s scoring')
    .replace(/v bodování soutěže/g, 'in league scoring')
    .replace(/Zápis (?=\d)/g, 'Recorded ').replace(/Výsledek (\d+) ku (\d+)/g, 'Score $1 to $2')
    .replace(/Zahrnuje (\d+) týmových zákroků doplněných jedinému evidovanému brankáři\./g,'Includes $1 team saves assigned to the only recorded goaltender.');
}
export function reportNames(summary) {
  return [summary.home?.name, summary.away?.name, summary.competition, summary.group, summary.season, summary.venue,
    ...(summary.players??[]).map(p=>p.name), ...(summary.goalies??[]).map(p=>p.name),
    ...(summary.timeline?.events??[]).flatMap(e=>[e.player?.name,e.allowedBy?.name,...(e.assists??[]).map(p=>p.name)])].filter(Boolean);
}
export function protectedReportText(value, lang, names = []) {
  if (lang !== 'en') return String(value??'');
  const choices=[...new Set(names)].filter(Boolean).sort((a,b)=>b.length-a.length);
  if (!choices.length) return reportText(value,lang);
  const pattern=new RegExp(`(${choices.map(escapeRegex).join('|')})`,'g');
  const protectedNames=new Set(choices);
  return String(value??'').split(pattern).map(part=>protectedNames.has(part)?part:reportText(part,lang)).join('');
}
// Only trusted, already-escaped render output is accepted. Script/JSON content and
// URL/data attributes are deliberately skipped. Never translate whole raw HMS payloads.
export function reportHtml(markup, lang, names = []) {
  if (lang !== 'en') return markup;
  const escapedNames=names.map(n=>String(n).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
  return markup.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<[^>]+>)/gi).map(part=>{
    if (/^<script\b/i.test(part)) return part;
    if (part.startsWith('<')) return part.replace(/\s(aria-label|title|alt)="([^"]*)"/g,(_,attr,text)=>` ${attr}="${protectedReportText(text,lang,escapedNames)}"`);
    return protectedReportText(part,lang,escapedNames);
  }).join('');
}

// Localize newly rendered fragments without replacing HTML, event listeners,
// data attributes, identifiers or links. Called at explicit render boundaries.
export function localizeReportNode(root, lang, names = []) {
  if (!root || lang !== 'en') return;
  const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node=walker.currentNode;
    if (node.parentElement?.closest('script,style')) continue;
    node.nodeValue=protectedReportText(node.nodeValue,lang,names);
  }
  for (const node of [root,...root.querySelectorAll('[aria-label],[title],[alt]')]) {
    for (const attr of ['aria-label','title','alt']) {
      if(node.hasAttribute(attr))node.setAttribute(attr,protectedReportText(node.getAttribute(attr),lang,names));
    }
  }
}
