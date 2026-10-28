import {PUBLIC_ORIGIN} from '../../public/public-output.js';
// Verified fallback, not an HMS original. Byte-for-byte logo from the official
// website recorded on this exact sponsor. The generic editor override remains.
export function verifiedSponsorLogo(org,sponsor,logo){
  if(logo.originalUrl)return logo;
  if(org.code==='EUCHL'&&sponsor.id==='900a2f40-d000-11f1-837b-27c5e6cdebf9'&&sponsor.website==='https://www.restauracecernyorel.cz/'){
    return {...logo,overrideUrl:PUBLIC_ORIGIN+'/sponsors/logos/restaurace-cerny-orel.png',overrideSource:{kind:'official-website',url:'https://www.restauracecernyorel.cz/images/logo.png',verifiedOn:'2026-10-28'},source:'verified-logo-override'};
  }
  return logo;
}
