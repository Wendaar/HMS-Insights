import {mountTeamComparison} from '../team-comparison/app.js';
// One mounted editor module, shared with the legacy definition route. No iframe,
// copied analytics, extra organization selector or separate export workflow.
export function setupTeamCompare({organization,language}){
 const button=document.getElementById('teamCompare'),panel=document.getElementById('teamComparePanel'),workspace=document.querySelector('.workspace'),intro=document.querySelector('.intro');
 let version=0,dispose=null,active=false;
 const querySection=on=>{const url=new URL(location.href);if(on)url.searchParams.set('section','team-compare');else url.searchParams.delete('section');history.replaceState(null,'',url.pathname+url.search);};
 async function mount(){
  const current=++version;dispose?.();dispose=null;panel.replaceChildren();const placeholder=document.createElement('p');placeholder.textContent=language()==='en'?'Loading Team Compare…':'Načítám Team Compare…';panel.append(placeholder);
  try{const response=await fetch('/team-comparison/index.html');if(!response.ok)throw Error();const source=new DOMParser().parseFromString(await response.text(),'text/html');source.querySelectorAll('script').forEach(s=>s.remove());if(current!==version)return;
   panel.replaceChildren();const host=document.createElement('div');panel.append(host);const shadow=host.attachShadow({mode:'open'}),style=document.createElement('link');style.rel='stylesheet';style.href='/team-comparison/app.css';shadow.append(style);const root=document.createElement('div');root.innerHTML=source.body.innerHTML;shadow.append(root);
   const editor=await mountTeamComparison(root,{mode:'manager',studio:true,org:organization(),lang:language(),query:new URLSearchParams({lang:language()}).toString()});if(current!==version)editor.dispose();else dispose=()=>editor.dispose();
  }catch{if(current===version)placeholder.textContent=language()==='en'?'Team Compare is unavailable. Reload the page.':'Team Compare není dostupné. Obnovte stránku.';}
 }
 button.onclick=()=>{active=true;workspace.hidden=true;intro.hidden=true;panel.hidden=false;for(const id of ['games','insights','teamCompare'])document.getElementById(id).setAttribute('aria-pressed',String(id==='teamCompare'));querySection(true);mount();};
 for(const id of ['games','insights'])document.getElementById(id).addEventListener('click',()=>{active=false;++version;dispose?.();dispose=null;panel.replaceChildren();panel.hidden=true;workspace.hidden=false;intro.hidden=false;button.setAttribute('aria-pressed','false');querySection(false);});
 document.getElementById('org').addEventListener('change',()=>{if(active){querySection(true);mount();}});
 document.getElementById('gameDay').addEventListener('click',()=>{active=false;++version;dispose?.();dispose=null;panel.replaceChildren();panel.hidden=true;});
}
