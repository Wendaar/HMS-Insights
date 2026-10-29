export const resultColors={W:'#48a94f',D:'#ed9b33',L:'#e5524d',goal:'#42dc8b'};
export function playerBadges(player,{esc,lang,context}){
 const en=lang==='en',names=en?{points:'points',goals:'goals',assists:'assists',gaa:'GAA',sv:'Sv%'}:{points:'body',goals:'góly',assists:'asistence',gaa:'GAA',sv:'Sv%'};
 const leaders=en?{points:'Scoring leader',goals:'Goal leader',assists:'Assist leader',gaa:'GAA leader',sv:'Save % leader'}:{points:'Lídr bodování',goals:'Lídr střelců',assists:'Lídr asistencí',gaa:'Lídr GAA',sv:'Lídr úspěšnosti'};
 return (player.badges??[]).filter(b=>Object.hasOwn(names,b.metric)&&Number.isInteger(b.rank)&&b.rank>=1&&b.rank<=(['gaa','sv'].includes(b.metric)?5:10)).map(b=>{
  const goalie=['gaa','sv'].includes(b.metric),label=b.leader?leaders[b.metric]:`TOP ${goalie?5:10} ${names[b.metric]} · #${b.rank}`;
  const rules=goalie?(en?'Goalie/team records with at least one start and a known metric. Lower GAA / higher save percentage ranks better. Ties share rank.':'Záznamy brankář–tým s alespoň jedním startem a známou hodnotou. Nižší GAA / vyšší úspěšnost znamená lepší pořadí. Shody sdílejí místo.'):(en?'Players with at least one start. Points ranking uses points, then goals, as in Game Report. Transfers are summed within this division and phase. Ties share rank.':'Hráči s alespoň jedním startem. Bodování řadí body a potom góly, stejně jako Game Report. Při přestupu se výkony sčítají v této divizi a fázi. Shody sdílejí místo.');
  const detail=`${context}. #${b.rank} / ${b.total}. ${rules} ${en?'Calculated from HMS statistics; not an official award.':'Výpočet ze statistik HMS; nejde o oficiální ocenění.'}`;
  return `<button type="button" class="player-badge ${b.leader?'leader':'top'}" data-help-title="${esc(label)}" data-help-text="${esc(detail)}" title="${esc(detail)}">${b.leader?'★ ':'◆ '}${esc(label)}</button>`;
 }).join('');
}
export const resultName=(result,lang='cs')=>({cs:{W:'Výhra',D:'Remíza',L:'Prohra'},en:{W:'Win',D:'Draw',L:'Loss'}}[lang==='en'?'en':'cs'][result]??'—');
export function helpButton(title,text,{esc,lang}){return `<button type="button" class="help" data-help-title="${esc(title)}" data-help-text="${esc(text)}" aria-label="${esc((lang==='en'?'Explain: ':'Vysvětlit: ')+title)}" title="${esc(text)}">?</button>`;}
export function setupHelp(root,language){
 let dialog=null,opener=null;
 function open(target){
  if(!dialog){dialog=document.createElement('dialog');dialog.className='help-dialog';dialog.innerHTML='<h2 id="comparisonHelpTitle"></h2><p></p><button type="button"></button>';dialog.setAttribute('aria-labelledby','comparisonHelpTitle');root.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});}
  opener=target;dialog.querySelector('h2').textContent=target.dataset.helpTitle;dialog.querySelector('p').textContent=target.dataset.helpText;dialog.querySelector('button').textContent=language()==='en'?'Close':'Zavřít';if(!dialog.open)dialog.showModal();
 }
 const click=e=>{const target=e.target.closest?.('[data-help-title]');if(target&&root.contains(target))open(target);};
 const key=e=>{if(['Enter',' '].includes(e.key)&&e.target.matches?.('g[data-help-title]')){e.preventDefault();open(e.target);}};
 root.addEventListener('click',click);root.addEventListener('keydown',key);
 return ()=>{root.removeEventListener('click',click);root.removeEventListener('keydown',key);if(dialog?.open)dialog.close();dialog?.remove();};
}
export function formBadges(team,{esc,lang}){return team.history.complete?team.form.map(g=>`<span class="result ${g.result}" title="${esc(resultName(g.result,lang)+' · '+g.date+' · '+g.opponent+' · '+g.score)}" aria-label="${esc(resultName(g.result,lang)+' · '+g.score)}">${g.result}</span>`).join(''):'';}
export function recordValue(team,{esc,lang}){return [['W',team.wins],['D',team.draws],['L',team.losses]].map(([r,v])=>`<span class="result-number ${r}" title="${esc(resultName(r,lang))}">${esc(v??'—')}</span>`).join('<span class="record-separator">–</span>');}
export function scoreValue(team,{esc}){const difference=Number.isFinite(team.goalsFor)&&Number.isFinite(team.goalsAgainst)?team.goalsFor-team.goalsAgainst:null;return `${esc(team.score??'—')}${difference===null?'':` <span class="goal-difference ${difference>0?'positive':difference<0?'negative':'neutral'}">(${difference>0?'+':''}${difference})</span>`}`;}
