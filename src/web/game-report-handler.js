import { reportLanguage, reportText } from '../../public/game-report-i18n.js';
import { getGameSummary } from "../app/game-summary.js";
import { isGameId } from "../domain/game-summary.js";
import { renderGameReport } from "./game-report.js";
import { mediaHosts } from '../../public/game-report-media.js';
import {publicPregame} from '../app/public-pregame.js';
import {renderMatchPreviewPage} from './match-preview-page.js';

export function createGameReportHandler({ json = false, loadSummary = getGameSummary, preview = false, loadPregame=publicPregame } = {}) {
  return async (request, response) => {
    response.setHeader("cache-control", "no-store");
    response.setHeader("x-content-type-options", "nosniff");
    const lang = reportLanguage(request.query?.lang);
    const fail = (status, message) => json
      ? response.status(status).json({ error: message })
      : response.status(status).send(reportText(message, lang));
    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      return fail(405, "Method not allowed");
    }
    const gameId = request.query?.gameId;
    if (!isGameId(gameId)) return fail(400, "Neplatné gameId.");
    try {
      const summary = await loadSummary(gameId);
      if (!summary) {
        if(!json){const pregame=await loadPregame(gameId);if(pregame){
          response.setHeader('content-type','text/html; charset=utf-8');
          response.setHeader('content-security-policy',"default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
          return response.status(200).send(renderMatchPreviewPage(pregame,{lang}));
        }}
        return fail(404, "Zápas zatím není importován.");
      }
      response.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
      if (json) return response.status(200).json(summary);
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.setHeader("content-security-policy", `default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' ${mediaHosts.map(h=>'https://'+h).join(' ')}; frame-src https://www.youtube-nocookie.com; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`);
      return response.status(200).send(renderGameReport(summary, { preview, lang: request.query?.lang }));
    } catch {
      // Do not serialize database errors, connection strings or HMS responses.
      return fail(503, "Data zápasu jsou dočasně nedostupná.");
    }
  };
}
