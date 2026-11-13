import {sportingImage} from './game-report-media.js';
import {escape as html} from './game-report-graphics.js';
export function portrait(person,{large=false,goalie=false}={}){
  const src=sportingImage(person.imageUrl),initials=person.name?.split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('')??'';
  return `<span class="portrait ${large?'portrait-large':''}${goalie?' portrait-goalie':''}"${person.id?` data-player-portrait="${html(person.id.toLowerCase())}"`:''}><span aria-hidden="true">${html(initials)}</span>${src?`<img src="${html(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}</span>`;
}
