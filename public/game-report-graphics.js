// Shared SVG views. All marks represent a zone, not a measured coordinate.
export const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eq = (a,b) => a && b && a.toLowerCase() === b.toLowerCase();
const hex = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : null;
export function jerseyColor(value){
  if(typeof value!=='string')return null;
  if(/^#[\da-f]{3}$/i.test(value))return '#'+[...value.slice(1)].map(c=>c+c).join('').toLowerCase();
  return hex(value)?.toLowerCase()??null;
}
const rgb=color=>color.slice(1).match(/../g).map(v=>parseInt(v,16));
const distance=(a,b)=>Math.hypot(...rgb(a).map((v,i)=>v-rgb(b)[i]));
export function teamPalette(summary) {
  const homeJersey=jerseyColor(summary.home.jerseyColor),awayJersey=jerseyColor(summary.away.jerseyColor);
  let home = homeJersey ?? hex(summary.home.color) ?? '#008d9f';
  if(!homeJersey&&awayJersey&&distance(home,awayJersey)<100)home=[summary.home.secondaryColor,'#008d9f','#9c428f','#de8422'].map(hex).find(c=>c&&distance(c,awayJersey)>=100);
  // An explicit match jersey is never recolored. Only inferred display colors
  // may be adjusted when club palettes are too similar to distinguish.
  const away = awayJersey ?? [summary.away.color, summary.away.secondaryColor, '#9c428f', '#de8422'].map(hex).find(c => c && distance(c,home)>=100);
  return {[summary.home.id.toLowerCase()]:home, [summary.away.id.toLowerCase()]:away};
}
function ink(color) {
  const rgb = color.slice(1).match(/../g).map(v=>parseInt(v,16));
  return rgb[0]*.299+rgb[1]*.587+rgb[2]*.114 > 160 ? '#102133' : '#ffffff';
}
export const colorOutline=color=>ink(color)==='#102133'?'#536779':'#ffffff';
export const rinkZones = {
  'left-corner':[38,72,58,42], 'behind-net':[145,27,70,26], 'right-corner':[264,72,58,42],
  'left-circle':[63,143,76,64], 'between-circles':[146,128,68,75], 'right-circle':[221,143,76,64],
  'left-blue-line':[40,232,70,34], 'center-blue-line':[145,232,70,34], 'right-blue-line':[250,232,70,34],
  'left-central-zone':[50,312,80,54], 'center-central-zone':[145,312,70,54], 'right-central-zone':[230,312,80,54],
  'left-defensive-zone':[55,438,72,40], 'center-defensive-zone':[146,438,68,40], 'right-defensive-zone':[233,438,72,40],
};
export const netZones = Object.fromEntries(['left-top-corner','top-shelf','right-top-corner','left-side','middle','right-side','left-bottom-corner','five-hole','right-bottom-corner'].map((code,i)=>[code,[32+i%3*99,36+Math.floor(i/3)*74,90,62]]));
const hash = value => [...String(value)].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,17);

export function goalMarks(events, field) {
  const bounds = field === 'shotZone' ? rinkZones : netZones;
  const byZone = new Map();
  for (const event of events.filter(e=>e.type==='goal')) {
    const zone = event.details?.[field]?.code;
    if (!bounds[zone]) continue;
    if (!byZone.has(zone)) byZone.set(zone,[]);
    byZone.get(zone).push(event);
  }
  const marks=[];
  for (const [zone, goals] of byZone) {
    const [x,y,w,h] = bounds[zone];
    const capacity = Math.max(2,Math.floor(w/27)*Math.floor(h/27));
    const clusters = [];
    const teams=[...new Set(goals.map(g=>g.teamId))].sort();
    for (const teamId of teams) {
      const group=goals.filter(g=>g.teamId===teamId).sort((a,b)=>a.id.localeCompare(b.id));
      if (goals.length>capacity || (zone==='between-circles' && group.length>=4)) clusters.push(group);
      else clusters.push(...group.map(g=>[g]));
    }
    const cols=Math.min(clusters.length,Math.max(1,Math.floor(w/28)));
    const rows=Math.ceil(clusters.length/cols);
    clusters.forEach((group,i)=>{
      const col=i%cols, row=Math.floor(i/cols);
      const rowCount=Math.min(cols,clusters.length-row*cols);
      const seed=hash(group.map(g=>g.id).join(':'));
      marks.push({zone,events:group,teamId:group[0].teamId,
        x:x+w/2+(col-(rowCount-1)/2)*28+(seed%5-2),
        y:y+h/2+(row-(rows-1)/2)*27+(Math.floor(seed/5)%5-2)});
    });
  }
  return marks;
}
const numberOf=(summary,event)=>summary.timeline.events.filter(e=>e.type==='goal').findIndex(e=>e.id===event.id)+1;
function marksSvg(summary,events,field,{mini=false,uid='map'}={}) {
  const palette=teamPalette(summary);
  return goalMarks(events,field).map(mark=>{
    const color=palette[mark.teamId?.toLowerCase()]??'#718096';
    const cluster=mark.events.length>1;
    const label=cluster?`×${mark.events.length}`:`${numberOf(summary,mark.events[0])}`;
    const title=mark.events.map(e=>`Gól ${numberOf(summary,e)} · ${e.player.name??''}${e.clock?` · ${e.clock}`:''}`).join(' / ');
    const attributes=mini?'':` role="button" tabindex="0" data-goal-ids="${escape(JSON.stringify(mark.events.map(e=>e.id)))}" aria-label="${escape(title)}"`;
    return `<g class="goal-pin${cluster?' goal-cluster':''}" transform="translate(${mark.x} ${mark.y})"${attributes}><title>${escape(title)}</title><circle r="${cluster?17:14}" fill="${color}" stroke="${colorOutline(color)}" stroke-width="2.5"/><text text-anchor="middle" dy=".35em" fill="${ink(color)}">${label}</text></g>`;
  }).join('');
}

export function rinkSvg(summary,events,{mini=false,uid='rink'}={}) {
  return `<svg viewBox="0 0 360 500" class="hockey-rink${mini?' mini-map':''}" role="group" aria-label="Místa vstřelených gólů"><defs><linearGradient id="${escape(uid)}-ice" x2="0" y2="1"><stop stop-color="#fcfeff"/><stop offset="1" stop-color="#dfeaf0"/></linearGradient></defs><path d="M18 488V95Q18 14 99 14H261Q342 14 342 95V488" fill="url(#${escape(uid)}-ice)" stroke="#9bb0bf" stroke-width="3"/><path d="M20 92H340 M20 335H340" class="ice-red"/><path d="M20 267H340 M20 410H340" class="ice-blue"/><path d="M43 488a55 55 0 0 1 110 0M207 488a55 55 0 0 1 110 0" class="ice-red"/><circle cx="180" cy="335" r="39" class="ice-red"/><circle cx="98" cy="175" r="55" class="ice-red"/><circle cx="262" cy="175" r="55" class="ice-red"/><circle cx="98" cy="175" r="3" fill="#c94b5c"/><circle cx="262" cy="175" r="3" fill="#c94b5c"/><path d="M152 92a28 28 0 0 0 56 0" fill="#c3deea" stroke="#6b9db6"/><path d="M159 91V73H201V91" fill="none" stroke="#b64959" stroke-width="3"/><path d="M18 483l8 8m-8 0 8-8m308 0 8 8m-8 0 8-8" stroke="#879fac" stroke-width="2"/>${marksSvg(summary,events,'shotZone',{mini,uid})}</svg>`;
}

export function netSvg(summary,events,{mini=false,uid='net'}={}) {
  return `<svg viewBox="0 0 360 278" class="hockey-net${mini?' mini-map':''}" role="group" aria-label="Umístění gólů v brance"><defs><pattern id="${escape(uid)}-mesh" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 0L16 16M16 0L0 16" fill="none" stroke="#afc2cc" stroke-width=".8"/></pattern></defs><path d="M18 259V62Q18 22 58 22H302Q342 22 342 62V259" fill="#e7f0f4" stroke="#adbac3" stroke-width="6"/><path d="M25 255V63Q25 30 58 30H302Q335 30 335 63V255Z" fill="url(#${escape(uid)}-mesh)" stroke="#c94754" stroke-width="4"/><path d="M17 259H343" stroke="#8ba4b3" stroke-width="4"/>${marksSvg(summary,events,'netZone',{mini,uid})}</svg>`;
}

export function unknownGoals(summary,events,field) {
  const bounds=field==='shotZone'?rinkZones:netZones;
  const unknown=events.filter(e=>e.type==='goal'&&!bounds[e.details?.[field]?.code]);
  if(!unknown.length)return '';
  return `<aside class="unplaced-goals"><h4>Neurčeno <span>${unknown.length}</span></h4><div class="unplaced-pins">${unknown.map(event=>`<button type="button" class="unplaced-pin" data-event-id="${escape(event.id)}" aria-label="${escape(`Gól ${numberOf(summary,event)} · ${event.player.name??''}${event.clock?` · ${event.clock}`:''}`)}">${numberOf(summary,event)}</button>`).join('')}</div></aside>`;
}

export function teamLegend(summary) {
  const palette=teamPalette(summary);
  return `<div class="team-legend">${[summary.home,summary.away].map(team=>`<span><svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill="${palette[team.id.toLowerCase()]}" stroke="#62798d"/></svg>${escape(team.name)}</span>`).join('')}</div>`;
}

export function miniGoalMaps(summary,event) {
  const shot=Boolean(rinkZones[event.details?.shotZone?.code]);
  const net=Boolean(netZones[event.details?.netZone?.code]);
  if(!shot&&!net)return '';
  return `<div class="event-mini-maps">${shot?`<figure>${rinkSvg(summary,[event],{mini:true,uid:'detail-rink'})}<figcaption>${escape(event.details.shotZone.label)}</figcaption></figure>`:''}${net?`<figure>${netSvg(summary,[event],{mini:true,uid:'detail-net'})}<figcaption>${escape(event.details.netZone.label)}</figcaption></figure>`:''}</div>`;
}
