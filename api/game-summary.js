import {createStudioImageHandler} from '../src/web/studio-image-handler.js';
import {createSeasonGamesHandler} from '../src/web/season-games-handler.js';
const seasonGames=createSeasonGamesHandler();
import {createBroadcastHandler} from '../src/web/broadcast-handler.js';
const broadcast=createBroadcastHandler();
const studioImage=createStudioImageHandler();
import {createStudioHandler} from '../src/web/studio-handler.js';
const studio=createStudioHandler();
import { createGameReportHandler } from "../src/web/game-report-handler.js";
import { createPlayerCardHandler } from '../src/web/player-card-handler.js';
import {createGameExtrasHandler} from '../src/web/game-extras-handler.js';
const extras=createGameExtrasHandler();
const summary=createGameReportHandler({json:true});
const playerCard=createPlayerCardHandler();
// Reuse a function for the player-card rewrite: keep the Hobby deployment at
// twelve functions while preserving the existing GameSummary JSON contract.
export default (request,response)=>request.query?.view==='games'?seasonGames(request,response):request.query?.view==='broadcast'?broadcast(request,response):request.query?.view==='studio-image'?studioImage(request,response):request.query?.view==='studio'?studio(request,response):request.query?.view==='extras'?extras(request,response):request.query?.view==='player-card'?playerCard(request,response):summary(request,response);
