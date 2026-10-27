export const RANKING_UPSET = "RANK_UPSET";

export function detectRankingUpset(game, ranking, minimumGap = 6) {
  if (!ranking || ranking.gameId?.toLowerCase() !== game.gameId.toLowerCase()) return null;
  const home = game.teamStats.find((team) => team.side === "HOME");
  const away = game.teamStats.find((team) => team.side === "AWAY");
  if (!home || !away || home.goals === away.goals) return null;
  if (ranking.homeTeamId?.toLowerCase() !== home.teamId.toLowerCase()
    || ranking.awayTeamId?.toLowerCase() !== away.teamId.toLowerCase()) return null;

  const winner = home.goals > away.goals ? home : away;
  const loser = winner === home ? away : home;
  const winnerRank = winner === home ? ranking.homeRank : ranking.awayRank;
  const loserRank = winner === home ? ranking.awayRank : ranking.homeRank;
  if (!Number.isSafeInteger(winnerRank) || !Number.isSafeInteger(loserRank)) return null;
  const rankDifference = winnerRank - loserRank;
  if (rankDifference < minimumGap) return null;

  const shock = rankDifference >= 9;
  return {
    id: `${game.gameId}:${RANKING_UPSET}:${winner.teamId}`,
    organizationId: game.organizationId,
    competitionId: game.competitionId,
    seasonId: game.seasonId,
    groupId: game.groupId,
    gameId: game.gameId,
    type: RANKING_UPSET,
    playerId: null,
    teamId: winner.teamId,
    importance: shock ? 98 : 92,
    title: shock ? "Šok kola" : "Překvapení kola",
    text: `${winner.teamName} (#${winnerRank}) porazil ${loser.teamName} (#${loserRank}).`,
    facts: {
      winnerRankBefore: winnerRank,
      loserRankBefore: loserRank,
      rankDifference,
      capturedAt: ranking.capturedAt,
    },
  };
}
