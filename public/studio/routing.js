import {normalizeLanguage} from './i18n.js';
export function studioOrganization(pathname,organizations){
  const match=/^\/studio(?:\/([a-zA-Z0-9-]+))?\/?$/.exec(pathname);
  if(!match)return null;
  return match[1]?organizations.find(o=>o.slug===match[1].toLowerCase())??null:organizations.find(o=>o.code==='PHM')??null;
}
export function studioUrl(organization,lang){
  if(!/^[a-z][a-z0-9-]{1,39}$/.test(organization?.slug))throw new TypeError('Invalid organization slug.');
  return `/studio/${organization.slug}?lang=${normalizeLanguage(lang)}`;
}
