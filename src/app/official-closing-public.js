import {toolStore} from '../infrastructure/tool-instances.js';
export const closingStorageNamespace=env=>env.VERCEL_ENV==='production'?'official-closing':'official-closing-preview';
export function publicClosing(instance,org,slug){
 const state=instance?.draft,p=state?.versions?.find(v=>v.approval?.version===state.publishedVersion);
 if(state?.deleted||!p||p.status!=='closed'||p.scope?.organization!==org.slug)return null;
 const {title,scope,scopeLabel,standings,awards,allStars,provenance,approval,teams,players}=p;
 return {schemaVersion:1,org:org.slug,slug,title,scope,scopeLabel,standings,awards,allStars,provenance,approvedAt:approval.approvedAt,version:approval.version,teams,players};
}
export async function publishedClosings(org,options={}){
 const env=options.env??process.env,store=options.closingStore??toolStore({env,tool:closingStorageNamespace(env)}),rows=await store.list(org.code),items=[];let index=0;
 await Promise.all(Array.from({length:Math.min(4,rows.length)},async()=>{while(index<rows.length){const row=rows[index++],p=publicClosing(await store.get(org.code,row.slug),org,row.slug);if(p)items.push(p);}}));
 return items.sort((a,b)=>b.approvedAt.localeCompare(a.approvedAt)||a.slug.localeCompare(b.slug));
}
