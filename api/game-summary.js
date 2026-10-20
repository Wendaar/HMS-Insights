import { createGameReportHandler } from "../src/web/game-report-handler.js";
import { createPlayerCardHandler } from '../src/web/player-card-handler.js';
const summary=createGameReportHandler({json:true});
const playerCard=createPlayerCardHandler();
// Reuse a function for the player-card rewrite: keep the Hobby deployment at
// twelve functions while preserving the existing GameSummary JSON contract.
export default (request,response)=>request.query?.view==='player-card'?playerCard(request,response):summary(request,response);
