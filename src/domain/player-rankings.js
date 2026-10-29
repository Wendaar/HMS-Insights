// Competition ranking: equal values share rank; the following place is skipped.
// The P/G tie-break is the same rule used by public Game Report player cards.
export function pointRanks(players){
 const sorted=players.filter(p=>Number.isFinite(p.points)&&Number.isFinite(p.goals)).sort((a,b)=>b.points-a.points||b.goals-a.goals),ranks=new Map();
 let rank=0,last=null;sorted.forEach((p,index)=>{const key=p.points+':'+p.goals;if(key!==last)rank=index+1;ranks.set(p.id,rank);last=key;});return ranks;
}
function metricRanks(players,metric,direction){
 const sorted=players.filter(p=>p.gp>=1&&Number.isFinite(p[metric])).sort((a,b)=>direction*(a[metric]-b[metric])),ranks=new Map();let rank=0,last=null;
 sorted.forEach((p,index)=>{if(p[metric]!==last)rank=index+1;ranks.set(p.key,rank);last=p[metric];});return {ranks,total:sorted.length};
}
export function assignComparisonBadges(teams,scope,{playersAvailable=true,goaliesAvailable=true}={}){
 const entries=teams.flatMap(t=>t.players),grouped=new Map();
 // Missing offensive values could conceal a leader. Do not rank a partial table.
 const pointsComplete=playersAvailable&&entries.every(p=>[p.gp,p.goals,p.assists,p.points].every(Number.isFinite));
 if(pointsComplete)for(const p of entries){const sum=grouped.get(p.id)??{id:p.id,points:0,goals:0,assists:0,gp:0};for(const k of ['points','goals','assists','gp'])sum[k]+=p[k];grouped.set(p.id,sum);}
 const people=[...grouped.values()].filter(p=>p.gp>=1),points=pointRanks(people),goals=metricRanks(people.map(p=>({...p,key:p.id})),'goals',-1),assists=metricRanks(people.map(p=>({...p,key:p.id})),'assists',-1);
 // HMS publishes goalie statistics for a player/team stint. Rank those records
 // directly; GAA values cannot safely be pooled across transfers without ice time.
 const keepers=goaliesAvailable?teams.flatMap(t=>t.goalies.map(p=>({...p,key:p.id+'|'+t.id}))):[],gaa=metricRanks(keepers,'gaa',1),sv=metricRanks(keepers,'sv',-1);
 for(const team of teams){
  for(const p of team.players){p.badges=[];if(!pointsComplete||p.gp<1)continue;const person=grouped.get(p.id),rank=points.get(p.id);
   if(rank<=10)p.badges.push({metric:'points',rank,total:people.length,leader:rank===1&&person.points>0});
   if(person.goals>0&&goals.ranks.get(p.id)===1)p.badges.push({metric:'goals',rank:1,total:goals.total,leader:true});
   if(person.assists>0&&assists.ranks.get(p.id)===1)p.badges.push({metric:'assists',rank:1,total:assists.total,leader:true});
  }
  for(const p of team.goalies){p.badges=[];if(p.gp<1)continue;const key=p.id+'|'+team.id;
   for(const [metric,data]of [['gaa',gaa],['sv',sv]]){const rank=data.ranks.get(key);if(rank<=5)p.badges.push({metric,rank,total:data.total,leader:rank===1});}
  }
 }
 return {source:'HMS',scope:{seasonId:scope.seasonId,groupId:scope.groupId,phaseId:scope.phaseId},minGames:1,pointsComplete,pointsTieBreak:'goals',goalieBasis:'player-team-record',version:'division-phase-badges-v1'};
}
