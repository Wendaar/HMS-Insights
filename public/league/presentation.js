export function themeVariables(value){
 const hex=/^#[a-f0-9]{6}$/i.test(value??'')?value:'#087b91';
 const channels=[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16));
 const linear=channels.map(c=>{const v=c/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
 const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
 const ink=luminance>.179?'#13243c':'#ffffff';
 return {'--portal-accent':hex,'--portal-on-accent':ink,'--portal-accent-ink':luminance>.45?'#13243c':hex,'--portal-soft':`rgb(${channels.map(c=>Math.round(c*.12+255*.88)).join(' ')})`};
}
export function seasonMedia(season,selected,branding){
 return {seasonLogoUrl:season.seasonId===selected.seasonId?branding?.season?.logoUrl??season.seasonLogoUrl:season.seasonLogoUrl,
  competitionLogoUrl:season.competitionId===selected.competitionId?branding?.competition?.logoUrl??season.competitionLogoUrl:season.competitionLogoUrl};
}
export function teamDivisions(teams,groups){
 const assigned=new Set();
 const divisions=groups.map(group=>{
  const items=teams.filter(t=>group.teamIds?.includes(t.id)||t.groupIds?.includes(group.id));
  items.forEach(t=>assigned.add(t.id));return {...group,teams:items,teamCount:items.length};
 });
 const unassigned=teams.filter(t=>!assigned.has(t.id));
 if(unassigned.length)divisions.push({id:'unassigned',name:null,teams:unassigned,teamCount:unassigned.length});
 return {teamCount:new Set(teams.map(t=>t.id)).size,divisions};
}
