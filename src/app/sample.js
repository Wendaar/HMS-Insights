import { analyzeHmsResponses } from "./analyze.js";
import { gameEventsResponse, lineupResponse } from "../fixtures/real-game-sanitized.js";

export const sampleAnalysis = analyzeHmsResponses(gameEventsResponse, lineupResponse);

