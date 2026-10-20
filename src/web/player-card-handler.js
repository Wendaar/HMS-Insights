import { isGameId } from '../domain/game-summary.js';
import { getPlayerCard } from '../app/player-card.js';
export function createPlayerCardHandler({loadCard=getPlayerCard}={}){
  return async(request,response)=>{
    response.setHeader('cache-control','no-store');response.setHeader('x-content-type-options','nosniff');
    if(request.method!=='GET'){response.setHeader('allow','GET');return response.status(405).json({error:'Method not allowed'});}
    const {gameId,playerId}=request.query??{};
    if(!isGameId(gameId)||!isGameId(playerId))return response.status(400).json({error:'Neplatný zápas nebo hráč.'});
    try{
      const card=await loadCard(gameId,playerId);
      if(!card)return response.status(404).json({error:'Hráč není v zápisu tohoto zápasu.'});
      response.setHeader('cache-control','public, s-maxage=120');
      return response.status(200).json(card);
    }catch{return response.status(503).json({error:'Statistiky se nyní nepodařilo načíst.'});}
  };
}
