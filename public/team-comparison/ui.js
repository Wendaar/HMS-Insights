export const resultColors={W:'#48a94f',D:'#ed9b33',L:'#e5524d',goal:'#42dc8b'};
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
