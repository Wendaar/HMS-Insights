// Public labels only. The server adds connection status; never put keys or UUIDs here.
export const defaultOrganizations=[
 {code:'PHM',slug:'phm',name:'PHM'},
 {code:'EUCHL',slug:'euchl',name:'EUCHL'},
 {code:'YHG',slug:'yhg',name:'YHG'},
 {code:'FLLH',slug:'fllh',name:'FLLH'},
 {code:'POLICE',slug:'police',name:'POLICE'},
 {code:'BNHLH',slug:'bnhlh',name:'BNHLH'},
];
export function normalizeOrganizationCatalog(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>64)throw new Error('Seznam organizací není dostupný.');
 const codes=new Set(),slugs=new Set();
 return rows.map(row=>{
  if(!row||!/^([A-Z][A-Z0-9_]{1,23})$/.test(row.code)||!/^([a-z][a-z0-9-]{1,39})$/.test(row.slug)
   ||typeof row.name!=='string'||!row.name.trim()||row.name.length>80||/[\x00-\x1f<>]/.test(row.name)||codes.has(row.code)||slugs.has(row.slug))throw new Error('Neplatný seznam organizací.');
  codes.add(row.code);slugs.add(row.slug);
  return {code:row.code,slug:row.slug,name:row.name.trim(),configured:row.configured===true};
 });
}
export function organizationFromCatalog(rows,value){
 if(typeof value!=='string')return null;
 return rows.find(row=>row.code===value.toUpperCase()||row.slug===value.toLowerCase())??null;
}
export async function loadOrganizationCatalog({fetchImpl=fetch}={}){
 const response=await fetchImpl('/api/studio?catalog=1',{cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Seznam organizací nelze načíst. Obnovte stránku.');
 return normalizeOrganizationCatalog((await response.json()).organizations);
}
