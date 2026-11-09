import {publicOutputUrl} from '../public-output.js';
// An iframe remains embedded even if a CMS/editor drops the optional URL flag.
// Comparing WindowProxy references does not access the cross-origin parent DOM.
export function isEmbeddedSchedule(params,context=globalThis.window){
 if(params?.get('embed')==='1')return true;
 try{return !!context&&context.self!==context.top;}catch{return true;}
}
export function gameReportNavigation(gameId,lang,embedded=false){
 if(typeof gameId!=='string'||!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(gameId))throw new TypeError('game');
 const path='/game-center/'+gameId+'/public?'+new URLSearchParams({lang:lang==='en'?'en':'cs'});
 // An embedded schedule must not navigate its frame into a protected report.
 // Keep the portal's current host, including the HMS custom domain and previews.
 return {href:embedded?path:publicOutputUrl(path),target:embedded?'_blank':null};
}
