import {browseSeasonGames,ScheduleSourceError} from '../app/season-games.js';
import {InvalidScheduleQuery} from '../domain/season-games.js';
export function createSeasonGamesHandler(options={}){
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
    if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({code:'method',error:'Read only'});}
    try{const data=await(options.browse??browseSeasonGames)(req.query??{},options);res.setHeader('cache-control','public, s-maxage=30, stale-while-revalidate=30');return res.status(200).json(data);}
    catch(error){const invalid=error instanceof InvalidScheduleQuery,rate=error instanceof ScheduleSourceError&&error.status===429;if(rate)res.setHeader('retry-after',String(error.retryAfter));return res.status(invalid?400:rate?429:503).json({code:invalid?'invalid_request':rate?'rate_limit':'unavailable',error:invalid?'Invalid season or filter':'Schedule temporarily unavailable'});}
  };
}
