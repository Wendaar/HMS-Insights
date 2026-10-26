import {shift} from './model.js';
export function demoData(org,range){
 const names=['Jan Novák','Petr Dvořák','Martin Svoboda','Tomáš Černý','Anna Veselá','Lucie Malá'];const competitions=['PHM Liga','PHM Cup'];
 const games=Array.from({length:66},(_,i)=>{const home={id:'team-'+i%6,name:['HC Vlci','Praha Bears','HC Letci','Sparta Amatéři','Ice Tigers','HC Kobra'][i%6],cash:i%3===0,paid:i%4!==0},away={id:'team-'+(i+1)%6,name:['HC Vlci','Praha Bears','HC Letci','Sparta Amatéři','Ice Tigers','HC Kobra'][(i+1)%6],cash:(i+1)%3===0,paid:i%5!==0};
  return {id:'demo-'+i,date:shift(range.from,i-18),time:['18:00','19:30','21:00'][i%3],status:i<40?'FINISHED':'PLANNED',home,away:i%13===0||i===45?{id:'',name:'',cash:null}:away,teamsKnown:true,competitionId:'comp-'+i%2,competition:org==='phm'?competitions[i%2]:org.toUpperCase()+' · soutěž '+(i%2+1),venue:'ICE ARENA',referees:i%9===0?[]:i%5===0?[names[i%4],names[(i+1)%4]]:[names[i%4]],timekeepers:i%11===0?[]:[names[4+i%2]]};});
 return {org:org.toUpperCase(),games,complete:true,source:'Ukázková data',readAt:new Date().toISOString(),mapping:{cash:true,paid:true}};
}
