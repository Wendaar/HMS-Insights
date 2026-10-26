export const feedLanguage=(value,org='PHM')=>['cs','en'].includes(value)?value:org.toUpperCase()==='EUCHL'?'en':'cs';
export const feedLocale=lang=>lang==='en'?'en-GB':'cs-CZ';
export const feedEnglish={
 'Příklepy':'Insights','PŘÍKLEPY':'INSIGHTS','Výběr':'Highlights','Archiv':'Archive','Archiv Příklepů':'Insights archive',
 'To nejlepší z ledu':'The best from the ice','VÝBĚR PŘÍKLEPŮ':'SELECTED HIGHLIGHTS','ÚPLNÁ HISTORIE':'FULL HISTORY','živý přehled':'live feed',
 'Nejsilnější momenty posledních dnů. U jednoho hráče v jednom zápase ukazujeme vždy jen jeho nejvýznamnější příběh.':'The biggest moments from recent games. Each player appears once per game with their most significant achievement.',
 'Procházejte všechny nalezené momenty napříč zápasy, hráči a týmy.':'Explore all recorded highlights across games, players and teams.',
 'vybraných momentů':'selected highlights','příklepů':'highlights','Nejnovější':'Latest','Včera':'Previous day','Dříve':'Earlier',
 'Pohled Příklepů':'Insights view','Vyhledávání a filtrování příklepů':'Search and filter Insights','Hledat hráče, tým nebo moment…':'Find a player, team or highlight…',
 'Filtry':'Filters','Sezona':'Season','Skupina':'Group','Tým':'Team','Fáze':'Phase','Stadion':'Venue','Partner':'Partner','Všechny':'All','Všichni':'All',
 'Zrušit všechny filtry':'Clear all filters','Načítám starší Příklepy…':'Loading earlier Insights…','Nic jsme nenašli':'No matches found',
 'Zkuste změnit hledání nebo některý z filtrů.':'Try another search or change the filters.','Zavřít':'Close','Otevřít detail zápasu v HMS':'Open the game in HMS',
 'Týmový moment':'Team highlight','VELKÁ VÝHRA':'BIG WIN','RYCHLÝ GÓL':'EARLY GOAL','VÍCEBODOVÝ ZÁPAS':'MULTI-POINT GAME','BRANKÁŘSKÝ VÝKON':'GOALTENDER PERFORMANCE',
 'Velká výhra':'Big win','Rychlý gól':'Early goal','Vícebodový zápas':'Multi-point game','Brankářský výkon':'Goaltender performance','Hattrick':'Hat trick',
 'Sdílet tento Příklep':'Share this Insight','Sdílet':'Share','✓ Odkaz zkopírován':'✓ Link copied','Otevřít Game Report →':'Open Game Report →',
 'Příklepy se nepodařilo načíst.':'Could not load Insights.','Zdroj neodpovídá organizaci této stránky.':'The source does not match this organization.',
 'Posuňte stránku znovu pro další pokus.':'Scroll again to retry.','ukázka':'demo',
 'Přehled automaticky nalezených hokejových momentů z HMS zápasů':'Hockey highlights detected from HMS game records',
};
export function feedText(value,lang='cs'){
 const text=String(value??'');if(lang!=='en')return text;
 return feedEnglish[text]??text;
}
export function insightCopy(item,lang='cs'){
 if(lang!=='en')return item;
 const f=item.facts??{},name=item.player||item.team||'Team',number=(key)=>Number.isFinite(f[key])?f[key]:null;
 const titles={HATTRICK:'Hat trick',BIG_SAVES:'Goaltender performance',MULTIPOINT_GAME:'Multi-point game',EARLY_GOAL:'Early goal',BIG_WIN:'Big win'};
 let text=item.text;
 const counted=(value,word)=>`${value} ${word}${value===1?'':'s'}`;
 if(item.type==='HATTRICK')text=number('goals')===null?`${name} scored a hat trick.`:`${name} scored ${f.goals} goals.`;
 if(item.type==='BIG_SAVES')text=number('saves')===null?`${name} delivered an outstanding goaltender performance.`:`${name} made ${f.saves} saves.`;
 if(item.type==='MULTIPOINT_GAME')text=number('points')===null?`${name} recorded a multi-point game.`:`${name} recorded ${counted(f.points,'point')}${number('goals')!==null&&number('assists')!==null?` (${counted(f.goals,'goal')} + ${counted(f.assists,'assist')})`:''}.`;
 if(item.type==='EARLY_GOAL')text=f.gameTime?`${name} scored at ${f.gameTime}.`:`${name} scored an early goal.`;
 if(item.type==='BIG_WIN')text=number('scoreDifference')===null?`${name} recorded a big win.`:`${name} won by ${f.scoreDifference} goals.`;
 return {...item,title:titles[item.type]??item.title,text,...(item.venue==='Neuvedený stadion'?{venue:'Venue not specified'}:{})};
}
export function insightStat(item,lang='cs'){
 if(item.type==='HATTRICK')return 'HATTRICK';
 if(item.type==='BIG_SAVES')return `${item.facts?.saves??'30+'} ${lang==='en'?'SAVES':'ZÁKROKŮ'}`;
 if(item.type==='MULTIPOINT_GAME')return `${item.facts?.points??'2+'} ${lang==='en'?'POINTS':'BODY'}`;
 if(item.type==='EARLY_GOAL')return `${lang==='en'?'GOAL':'GÓL'} ${item.facts?.gameTime??(lang==='en'?'EARLY':'BRZY')}`;
 if(item.type==='BIG_WIN')return `${lang==='en'?'WIN':'VÝHRA'} +${item.facts?.scoreDifference??'5'}`;
 return item.type;
}
// Translate only trusted presentation markup. JSON/data/URLs and sporting names stay intact.
export function feedHtml(markup,lang,names=[]){
 if(lang!=='en')return markup;
 const protectedNames=new Set(names.filter(Boolean));
 const translate=text=>{
  const trimmed=text.trim();if(protectedNames.has(trimmed))return text;
  let result=feedEnglish[trimmed];
  if(result===undefined&&trimmed.includes(' · ')){
   const index=trimmed.lastIndexOf(' · '),suffix=trimmed.slice(index+3);if(feedEnglish[suffix])result=trimmed.slice(0,index+3)+feedEnglish[suffix];
  }
  if(result===undefined&&trimmed.startsWith('Otevřít detail: '))result='Open details: '+trimmed.slice('Otevřít detail: '.length);
  return result===undefined?text:text.replace(trimmed,result);
 };
 return markup.split(/(<script\b[^>]*>[\s\S]*?<\/script>|<[^>]+>)/gi).map(part=>{
  if(/^<script\b/i.test(part))return part;
  if(part.startsWith('<'))return part.replace(/\s(aria-label|title|placeholder|alt|content)="([^"]*)"/g,(_,key,text)=>` ${key}="${translate(text)}"`);
  return translate(part);
 }).join('');
}
