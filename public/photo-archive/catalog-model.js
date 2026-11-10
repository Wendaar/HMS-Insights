export function archivePeriod(filter,now=new Date(),page=0){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const shift=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const ranges={Today:[0,0],Yesterday:[-1,-1],'-7 days':[-7,-1],'+7 days':[1,7],Past:[-30*(page+1),-1-30*page],Future:[1+30*page,30*(page+1)]};
  if(!ranges[filter] || !Number.isInteger(page)||page<0)throw new TypeError('Neplatné období');
  return {from:shift(ranges[filter][0]),to:shift(ranges[filter][1])};
}

// A selected range is one pagination session. Never reuse a cursor from another
// range, and continue beyond the first page for manual range changes as well.
export async function readArchivePages({read,from,to,offset=0,onPage=()=>{},stopped=()=>false,maxPages=20}){
  let result,count=0,albums=0;
  for(let page=0;page<maxPages;page++){
    result=await read({from,to,offset});
    if(result.from!==from||result.to!==to || result.offset!==offset || !Number.isInteger(result.nextOffset) || result.hasMore && result.nextOffset<=offset)throw Error('HMS vrátilo nesprávnou stránku období.');
    count+=result.games;albums+=result.albums;await onPage(result,{count,albums});
    if(!result.hasMore || stopped())break;offset=result.nextOffset;
  }
  return {...result,count,albums};
}

export function catalogInRange(catalog,range,ids=null){
  return catalog.filter(c=>(!range || c.playedOn>=range.from && c.playedOn<=range.to) && (!ids || ids.has(c.gameId.toLowerCase())));
}
