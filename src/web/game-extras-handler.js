import {getGameExtras} from '../app/game-extras.js';
import {isGameId} from '../domain/game-summary.js';
export function createGameExtrasHandler({loadExtras=getGameExtras}={}){return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Method not allowed'});}
  if(!isGameId(req.query?.gameId))return res.status(400).json({error:'Neplatný zápas.'});
  try{const data=await loadExtras(req.query.gameId);if(!data)return res.status(404).json({error:'Zápas není importován.'});return res.status(200).json(data);}catch{return res.status(503).json({error:'Doplňky zápasu jsou nyní nedostupné.'});}
};}
