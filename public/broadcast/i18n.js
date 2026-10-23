export const language=value=>value==='en'?'en':'cs';
const en={
  'Organizace':'Organization','Jazyk':'Language','Odkaz na zápas v HMS nebo Game ID':'HMS game link or Game ID','Načíst zápas':'Load game',
  'Dnes':'Today','Zítra':'Tomorrow','Příštích 7 dnů':'Next 7 days','Minulé zápasy':'Past games','Obnovit z HMS':'Refresh from HMS',
  'Vyber zápas':'Select a game','OBS overlay':'OBS overlay','YouTube miniatura':'YouTube thumbnail','Kopírovat OBS URL':'Copy OBS URL',
  'Otevřít čistý náhled':'Open clean view','Stáhnout PNG':'Download PNG','Unikátní OBS URL vybraného zápasu':'OBS URL for the selected game and layer',
  'Upozornění k datům:':'Data notice:','Domácí':'Home','Hosté':'Away','Čas':'Time','Datum':'Date','Místo':'Venue','Rozhodčí':'Referee','Časoměřič':'Timekeeper',
  'Bude doplněno':'To be confirmed','Místo bude doplněno':'Venue to be confirmed','Datum bude doplněno':'Date to be confirmed','Bez data':'No date',
  'Náhled grafiky':'Graphics preview','Logo není dostupné':'Logo unavailable','Domácí tým · podrobnosti po výběru':'Home team · select for details',
  'Hosté · podrobnosti po výběru':'Away team · select for details','Podrobnosti po výběru zápasu':'Select the game for details',
  'Rozhodčí zatím není v HMS vyplněný.':'The referee has not been entered in HMS.','Časoměřič zatím není v HMS vyplněný.':'The timekeeper has not been entered in HMS.',
  'Místo zatím není v HMS vyplněné.':'The venue has not been entered in HMS.','Načítám zápasy…':'Loading games…','Obnovuji data z HMS…':'Refreshing HMS data…',
  'Původní Google Sheet':'Legacy Google Sheet','Původní PHM Sheet · kompatibilní režim':'Legacy PHM Sheet · compatibility mode',
  'Zpět do ovládání':'Back to controls','URL zkopírována':'URL copied','URL označena':'URL selected','Připravuji…':'Preparing…',
  'Vybraný zápas nebyl nalezen.':'The selected game was not found.','V OBS URL chybí Game ID.':'The OBS URL is missing a Game ID.',
  'HMS data nejsou dostupná.':'HMS data is unavailable.','HMS vrátilo jinou organizaci.':'HMS returned a different organization.',
  'Neplatná organizace nebo zdroj dat.':'Invalid organization or data source.','Data se nepodařilo načíst.':'Could not load data.',
  'Vložte HMS odkaz na zápas nebo Game ID.':'Enter an HMS game link or Game ID.','Vyberte PHM nebo EUCHL a vložte platné Game ID.':'Select PHM or EUCHL and enter a valid Game ID.',
  'Odpověď neodpovídá vybranému zápasu a organizaci.':'The response does not match the selected game and organization.',
  'V HMS chybí názvy týmů.':'Team names are missing in HMS.',
  'Předzápasová data nejsou dostupná. Ověřte zápas a připojení vybrané organizace.':'Game data is unavailable. Check the game and the selected organization connection.',
  'Pro vybrané období nejsou žádné dostupné zápasy. Můžete načíst konkrétní zápas jeho HMS odkazem.':'No games available for this period. You can load a specific game using its HMS link.',
  'Ověřte organizaci, odkaz na zápas a připojení HMS. Při výpadku se žádný jiný zápas automaticky nevybere.':'Check the organization, game link and HMS connection. A different game will never be selected automatically.',
  'Vybraný zápas je načtený. Seznam dalších zápasů se nyní nepodařilo načíst.':'The selected game is loaded. The list of other games is currently unavailable.',
  'Vrstva':'Layer','Před zápasem':'Pregame','Stav po třetinách':'Period summary','Soupiska':'Lineup','Přehled gólů':'Goals / scoresheet','Malé insights':'Compact insights',
  'Tým':'Team','Oba týmy':'Both teams','Třetina / stav':'Period / score','Aktuální / konečný stav':'Current / final score',
  'Po 1. třetině':'After period 1','Po 2. třetině':'After period 2','Po 3. třetině':'After period 3','Strana':'Page','Insight':'Insight',
  'Žádný dostupný insight':'No insight available','Čekáme na data v HMS':'Waiting for HMS data','Soupiska ještě není v HMS vyplněná.':'The lineup has not been entered in HMS yet.',
  'Neúplné gólové události v HMS':'Incomplete goal events in HMS','Třetiny nejsou v HMS kompletně přiřazené.':'Periods have not been fully assigned in HMS.',
  'Zatím žádný zapsaný gól':'No goals recorded yet','Zatím žádný hattrick ani vícebodový výkon':'No hat trick or multi-point performance yet',
  'Hattrick':'Hat trick','Vícebodový zápas':'Multi-point game','Góly':'Goals','Asistence':'Assists','Body':'Points','Brankář':'Goalie',
  'Čas dle HMS':'Time as recorded in HMS','Střelec neuveden':'Scorer not recorded','Zapsaný stav v HMS':'Recorded score in HMS','Konečný výsledek':'Final score',
  'Před začátkem zápasu':'Before puck drop','Podle zapsaných gólových událostí · bez živé časomíry':'From recorded goal events · no live game clock',
  'Výsledek je upravený nebo události nejsou úplné.':'The score was adjusted or events are incomplete.',
  'Výběr vrstvy mění náhled a kopírovanou adresu. V OBS použijte adresu dané vrstvy.':'Layer selection changes the preview and copied URL. Use that layer’s URL in OBS.',
  'Zápasová soupiska z HMS':'Game lineup from HMS','Na této stránce nejsou další hráči.':'No more players on this page.',
  'Jeden zdroj do OBS':'One source for OBS','Tuto adresu vložte do OBS jednou. Změny níže se přenesou automaticky.':'Add this URL to OBS once. Changes below are sent automatically.',
  'Kopírovat stálou OBS adresu':'Copy permanent OBS URL','Skrýt v OBS':'Hide in OBS','Zobrazit v OBS':'Show in OBS',
  'Odeslat aktuální náhled do OBS':'Send current preview to OBS','Vytvořit OBS kanál':'Create OBS channel',
  'Vytvořte jeden kanál a přepínejte jeho obsah z tohoto ovládání.':'Create one channel and switch its content from these controls.',
  'Odesílám do OBS…':'Sending to OBS…','V OBS je grafika zapnutá.':'Graphics are visible in OBS.','V OBS je grafika skrytá.':'Graphics are hidden in OBS.',
  'Ovládání se pamatuje v tomto prohlížeči. Veřejná OBS adresa neumožňuje kanál měnit.':'Control access is saved in this browser. The public OBS URL cannot change the channel.',
  'Kanál nebyl nalezen.':'Channel not found.','OBS kanál nyní není dostupný. Zkuste to znovu.':'The OBS channel is currently unavailable. Please retry.',
  'Kanál nebyl změněn. Obnovte ovládání; kanál mohl změnit jiný ovladač.':'The channel was not changed. Reconnect; another controller may have changed it.',
  'Zálohovat soukromý odkaz k ovládání':'Back up private controller link',
  'Soukromý odkaz zkopírován. Uschovejte si jej; umožňuje měnit výstup.':'Private link copied. Keep it safe; it allows changing the output.',
  'Kopírování není dostupné v tomto prohlížeči.':'Clipboard access is not available in this browser.',
  'Přepínání níže automaticky mění obsah stálého OBS kanálu.':'Selections below automatically change the permanent OBS channel output.',
  'Vyberte zápas ze seznamu nebo vložte jeho HMS odkaz. Přepnutí období nemění výstup v OBS.':'Select a game from the list or enter its HMS link. Browsing dates does not change OBS output.',
  'Seznam zápasů se nepodařilo načíst. Zkuste Obnovit z HMS nebo vložte odkaz na zápas.':'Could not load the game list. Retry Refresh from HMS or enter a game link.',
  'HMS odmítlo přístup organizace. Je potřeba ověřit její API klíč a oprávnění.':'HMS refused access for this organization. Its API key and permissions need to be checked.',
  'HMS dočasně omezuje počet požadavků. Vyčkejte prosím a zkuste načtení znovu.':'HMS is temporarily limiting requests. Please wait before retrying.',
  'HMS nyní nevrací zápasová data. Zkuste prosím načtení znovu.':'HMS is currently not returning game data. Please retry.',
  'HMS neodpovědělo včas. Zkuste prosím načtení znovu.':'HMS did not respond in time. Please retry.',
};
export function translate(value,lang){
  if(lang!=='en')return value;
  if(en[value])return en[value];
  return value.replace(/Po ([123])\. třetině/g,'After period $1').replace(/načteno /g,'loaded ').replace(/vyberte zápas/g,'select a game')
    .replace(/Rozhodčí zatím není v HMS vyplněný\./g,en['Rozhodčí zatím není v HMS vyplněný.']).replace(/Časoměřič zatím není v HMS vyplněný\./g,en['Časoměřič zatím není v HMS vyplněný.']).replace(/Místo zatím není v HMS vyplněné\./g,en['Místo zatím není v HMS vyplněné.'])
    .replace(/zobrazeno prvních 20 zápasů, další otevřete odkazem/g,'first 20 games shown; open others by link')
    .replace(/(\d+) zápasů/g,'$1 games').replace(/1920 × 1080 · transparentní/g,'1920 × 1080 · transparent');
}
export function localize(root,lang){
  if(lang!=='en')return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){const trimmed=node.textContent.trim();if(trimmed)node.textContent=node.textContent.replace(trimmed,translate(trimmed,lang));}
  for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]'))for(const attr of ['aria-label','title','placeholder'])if(el.hasAttribute(attr))el.setAttribute(attr,translate(el.getAttribute(attr),lang));
}
