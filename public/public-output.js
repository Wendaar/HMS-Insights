// Public destinations use the production domain; admin/API/preview URLs stay local.
export const PUBLIC_ORIGIN='https://app.phmcup.cz';
export function publicOutputUrl(value,base=PUBLIC_ORIGIN){
 const source=new URL(value,base),target=new URL(PUBLIC_ORIGIN);
 target.pathname=source.pathname;target.search=source.search;target.hash=source.hash;
 return target.href;
}
