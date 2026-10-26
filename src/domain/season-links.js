export const seasonSlug=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function seasonLinks(org,items){
 const years=new Map();for(const item of items){const slug=seasonSlug(item.season);years.set(slug,(years.get(slug)??0)+1);}
 const candidates=items.map(item=>{
  const season=seasonSlug(item.season),competition=seasonSlug(item.competition);
  return {...item,gamesPath:season?`/games/${org}/${years.get(season)>1?competition+'/':''}${season}`:null};
 });
 return candidates.map(item=>({...item,gamesPath:item.gamesPath&&candidates.filter(c=>c.gamesPath===item.gamesPath).length===1?item.gamesPath:null}));
}
