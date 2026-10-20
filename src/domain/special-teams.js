import { isMinorPenalty, recordedSituation } from "./goal-details.js";

// A conservative subset: one active short penalty, an elapsed game clock,
// and a score-consistent event log. Unsupported penalties, queued same-team overlaps or reset clocks
// disable inference; direct HMS goal labels always take precedence.
export function applySpecialTeams(events, { consistent, ordered, penaltiesAvailable, homeId, awayId }) {
  const relevant = events.filter((event) => ["goal", "penalty"].includes(event.type));
  const penalties = relevant.filter((event) => event.type === "penalty");
  let supported = consistent && ordered && penaltiesAvailable
    && relevant.every((event) => event.clockSeconds !== null && [homeId, awayId].includes(event.teamId))
    && relevant.every((event, index) => !index || event.clockSeconds >= relevant[index - 1].clockSeconds)
    && penalties.every((event) => (isMinorPenalty(event) || (!event.penaltyDetails?.type?.name && !event.penaltyDetails?.type?.code))
      && event.penaltyMinutes > 0 && event.penaltyMinutes <= 2);
  // Queued/double-minor mechanics are not represented by this subset.
  for (let i = 0; i < penalties.length; i++) for (let j = i + 1; j < penalties.length; j++) {
    if (penalties[i].teamId === penalties[j].teamId
      && penalties[j].clockSeconds < penalties[i].clockSeconds + penalties[i].penaltyMinutes * 60) supported = false;
  }
  const penaltyTimes = new Set(penalties.map((event) => event.clockSeconds));
  if (relevant.some((event) => event.type === "goal" && penaltyTimes.has(event.clockSeconds))) supported = false;
  let active = [];
  for (const event of relevant) {
    active = active.filter((penalty) => penalty.end > event.clockSeconds);
    if (event.type === "penalty") {
      active.push({ id: event.id, teamId: event.teamId, end: event.clockSeconds + event.penaltyMinutes * 60,
        basis: isMinorPenalty(event) ? 'minor-penalty' : 'duration-assumption' });
      continue;
    }
    const recorded = recordedSituation(event);
    const canDerive = supported && !penaltyTimes.has(event.clockSeconds)
      && !/shootout|penalty shot|trestn[ée] střílen/i.test(event.details?.goalSubtype?.name ?? "");
    const own = active.filter(p=>p.teamId===event.teamId).length;
    const opposing = active.length-own;
    const manpower = canDerive ? { for: 5-own, against: 5-opposing } : null;
    const candidate = !manpower ? null : manpower.for > manpower.against ? 'PP' : manpower.for < manpower.against ? 'SH' : 'EV';
    event.situation = recorded.source === "hms" ? recorded
      : candidate ? { code: candidate, source: "penalty-model", basis: active.length ? active.some(p=>p.basis==='duration-assumption') ? 'duration-assumption' : 'minor-penalty' : 'no-active-penalty',
        manpower, label: `${manpower.for} na ${manpower.against}` }
        : recorded;
    if (candidate === "PP" && ["PP", "UNKNOWN"].includes(recorded.code)) active = [];
    if (candidate && recorded.source === "hms" && recorded.code !== candidate) supported = false;
  }
  return supported;
}

// Count advantage phases, including a short penalty interrupted by an opposing
// penalty. Queued same-team penalties and unsupported sanctions stay unavailable.
export function specialTeamTotals(events, options) {
  const copy = structuredClone(events);
  const supported = applySpecialTeams(copy, options);
  const teams = Object.fromEntries([options.homeId, options.awayId].map(id => [id, {
    EV: 0, PP: 0, SH: 0, opportunities: null, shorthanded: null, concededPP: 0,
    ppPercentage: null, pkPercentage: null,
  }]));
  for (const e of copy.filter(e => e.type === 'goal')) {
    if (teams[e.teamId] && ['EV','PP','SH'].includes(e.situation?.code)) teams[e.teamId][e.situation.code]++;
  }
  teams[options.homeId].concededPP=teams[options.awayId].PP;
  teams[options.awayId].concededPP=teams[options.homeId].PP;
  const penalties = copy.filter(e => e.type === 'penalty');
  const paired = new Set();
  for (let i=0;i<penalties.length;i++) for(let j=i+1;j<penalties.length;j++) {
    const a=penalties[i],b=penalties[j];
    if(a.teamId!==b.teamId && a.clockSeconds===b.clockSeconds && a.penaltyMinutes===b.penaltyMinutes) {paired.add(i);paired.add(j);}
  }
  if(!supported) return { available:false, teams };
  for(const team of Object.values(teams)) {team.opportunities=0;team.shorthanded=0;}
  const excluded=new Set(penalties.filter((p,i)=>paired.has(i)).map(p=>p.id));
  const relevant=copy.filter(e=>['goal','penalty'].includes(e.type));
  const times=[...new Set([...relevant.map(e=>e.clockSeconds),...penalties.map(p=>p.clockSeconds+p.penaltyMinutes*60)])].sort((a,b)=>a-b);
  let active=[],previous=null;
  const advantage=()=>active.length===1?(active[0].teamId===options.homeId?options.awayId:options.homeId):null;
  const observe=()=>{const side=advantage();if(side&&side!==previous){teams[side].opportunities++;teams[side===options.homeId?options.awayId:options.homeId].shorthanded++;}previous=side;};
  for(const time of times){
    active=active.filter(p=>p.end>time);
    const atTime=relevant.filter(e=>e.clockSeconds===time);
    for(const p of atTime.filter(e=>e.type==='penalty'&&!excluded.has(e.id)))active.push({teamId:p.teamId,end:time+p.penaltyMinutes*60});
    observe();
    for(const g of atTime.filter(e=>e.type==='goal'))if(g.situation?.code==='PP'&&advantage()===g.teamId){active=[];observe();}
  }
  for(const [id,team] of Object.entries(teams)) {
    const opponent=teams[id===options.homeId?options.awayId:options.homeId];
    team.concededPP=opponent.PP;
    if(team.PP>team.opportunities || team.concededPP>team.shorthanded) return {available:false,teams:Object.fromEntries(Object.entries(teams).map(([key,t])=>[key,{...t,opportunities:null,shorthanded:null,ppPercentage:null,pkPercentage:null}]))};
    team.ppPercentage=team.opportunities?100*team.PP/team.opportunities:null;
    team.pkPercentage=team.shorthanded?100*(1-team.concededPP/team.shorthanded):null;
  }
  return {available:true,teams};
}
