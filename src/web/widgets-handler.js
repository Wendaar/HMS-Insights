import {readWidgetLeaders,readWidgetPlayerCard} from '../app/widgets.js';
import {organizationEntry} from '../app/organizations.js';
import {isGameId} from '../domain/game-summary.js';
export function createWidgetsHandler(options={}){
 return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const q=req.query??{};let org;try{org=organizationEntry(q.org,options.env??process.env);}catch{return res.status(404).json({error:'Neznámá organizace.'});}
  if(q.action&&!['leaders','player-card'].includes(q.action)||q.action==='player-card'&&!isGameId(q.playerId))return res.status(400).json({error:'Neplatný požadavek widgetu.'});
  try{
   const data=await(q.action==='player-card'?(options.readPlayerCard??readWidgetPlayerCard):(options.readLeaders??readWidgetLeaders))(org.code,q,options);
   if(!data)return res.status(404).json({error:'Hráč není v tomto výběru.'});
   return res.status(200).json(data);
  }catch(e){return res.status(e instanceof TypeError?400:503).json({error:e instanceof TypeError?'Zkontrolujte statistiku a kontext widgetu.':'Statistiky HMS nyní nejsou dostupné. Zkuste načtení znovu.'});}
 };
}
