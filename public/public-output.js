// Both production hosts run the same applications. Keep visitors on the host
// they entered; preview/export callers without a production context use PHM.
export const PUBLIC_ORIGIN='https://app.phmcup.cz';
const origins=[PUBLIC_ORIGIN,'https://public.heromanagementsystem.com'];
const currentBase=()=>globalThis.location?.origin??PUBLIC_ORIGIN;
export function publicOutputUrl(value,base=currentBase()){
 const source=new URL(value,base),origin=new URL(base).origin;
 const target=new URL(origins.includes(origin)?origin:PUBLIC_ORIGIN);
 target.pathname=source.pathname;target.search=source.search;target.hash=source.hash;
 return target.href;
}
export function sameSiteUrl(value,base=currentBase()){
 if(value.startsWith('/'))return value;
 try{const url=new URL(value);return origins.includes(url.origin)?publicOutputUrl(value,base):value;}catch{return value;}
}
