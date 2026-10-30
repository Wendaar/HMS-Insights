export function fixtureDate(date, en=false) {
  const instant=new Date(`${date}T12:00:00Z`),locale=en?'en-GB':'cs-CZ';
  if(!Number.isFinite(instant.getTime()))return {date:'—',day:'—'};
  return {
    date:new Intl.DateTimeFormat(locale,{timeZone:'Europe/Prague',day:'2-digit',month:'2-digit',year:'numeric'}).format(instant),
    day:new Intl.DateTimeFormat(locale,{timeZone:'Europe/Prague',weekday:'long'}).format(instant),
  };
}
export const invitationTemplates={
 cs:`Ahoj,

srdečně vás zveme na váš zápas v rámci {competition}.

🏒 {home} vs. {away}
📅 {date} · {day}
🕒 {time}
📍 {venue}

Prosíme, vyplňte si svou zápasovou soupisku včetně čísel dresů v aplikaci HMS:
https://prod.hms.wootera.net/
Soupiska musí být vyplněná před zahájením utkání.

Dresy si prosím vezměte podle přiložené grafiky.

Detail zápasu: {link}

Více analýz k zápasu najdete zde: {analysis}

Děkujeme a těšíme se na vás! Užijte si zápas,
Vaše {organization}`,
 en:`Hi,

you're invited to your upcoming game in {competition}.

🏒 {home} vs. {away}
📅 {date} · {day}
🕒 {time}
📍 {venue}

Please complete your game roster, including jersey numbers, in HMS:
https://prod.hms.wootera.net/
Your roster must be completed before the game starts.

Please bring the jerseys shown in the attached graphic.

Game details: {link}

More match analysis: {analysis}

Thank you and enjoy the game!
Your {organization} team`,
};
export function invitationText(p,{en=false,template,organization=p.org??'HMS'}={}) {
 const calendar=fixtureDate(p.date,en),unknown=en?'To be confirmed':'Bude upřesněno';
 const localized=url=>{if(!url)return '';const value=new URL(url,'https://app.phmcup.cz');value.searchParams.set('lang',en?'en':'cs');return value.href;};
 const values={...calendar,competition:p.competition||unknown,home:p.home.name,away:p.away.name,time:p.time||unknown,venue:p.venue||unknown,link:localized(p.links.game),analysis:localized(p.links.compare),organization};
 let text=(template??invitationTemplates[en?'en':'cs']).replace(/\{([a-z]+)\}/g,(whole,key)=>Object.hasOwn(values,key)?values[key]:whole);
 if(!values.analysis)text=text.split('\n').filter(line=>!/^\s*(Více analýz k zápasu najdete zde:|More match analysis:)\s*$/.test(line)).join('\n');
 // Existing saved templates also receive the new fixture-specific analysis link.
 if(values.analysis&&!text.includes(values.analysis))text+='\n\n'+(en?'More match analysis: ':'Více analýz k zápasu najdete zde: ')+values.analysis;
 return text;
}
export function gameDayText(items,{en=false,organization='HMS'}={}) {
 if(!items.length)return '';
 const date=fixtureDate(items[0].date,en);
 return [`🏒 ${organization} · GAME DAY`,`${date.day} · ${date.date}`,'',...items.map(p=>`${p.time??'—'} · ${p.venue??'—'}\n${p.home.name} vs. ${p.away.name}`)].join('\n\n');
}
export function downloadGraphic(file) {
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
// Call directly during the user's click, with an already rendered file. Native
// share receives one consistent image+text snapshot and keeps user activation.
export async function shareInvitation({file,text,title='HMS · Game Day',navigatorApi=navigator,open=(url)=>window.open(url,'_blank','noopener,noreferrer'),download=downloadGraphic}) {
 if(navigatorApi.canShare?.({files:[file],text})&&navigatorApi.share){
  try {await navigatorApi.share({files:[file],text,title});return 'shared';}
  catch(error){if(error.name==='AbortError')return 'cancelled';}
 }
 // A wa.me link carries text only. Supply the graphic separately and let the
 // user choose their group; never claim that wa.me attached an image.
 download(file);
 open('https://wa.me/?text='+encodeURIComponent(text));
 return 'fallback';
}
