import { sampleAnalysis } from "./sample.js";

const realGame = sampleAnalysis.game;
const home = realGame.teamStats.find((team) => team.side === "HOME");
const away = realGame.teamStats.find((team) => team.side === "AWAY");

const realItems = sampleAnalysis.priklepy.map((item) => {
  const player = realGame.players.find((candidate) => candidate.playerId === item.playerId);
  const team = realGame.teamStats.find((candidate) => candidate.teamId === item.teamId);
  return {
    ...item,
    date: realGame.playedOn,
    competition: realGame.competitionName,
    season: realGame.seasonName,
    group: realGame.groupName,
    groupColor: realGame.groupColor,
    groupLogoUrl: realGame.groupLogoUrl,
    groupLogoTemplateUrl: realGame.groupLogoTemplateUrl,
    phase: realGame.phaseName,
    venue: realGame.venueName ?? "Neuvedený stadion",
    venueLogoTemplateUrl: realGame.venueLogoTemplateUrl,
    venueLogoUrl: realGame.venueLogoUrl,
    sponsor: "Bez partnera",
    homeTeam: home.teamName,
    awayTeam: away.teamName,
    homeScore: realGame.homeScore,
    awayScore: realGame.awayScore,
    team: team?.teamName ?? "",
    player: player?.playerName ?? "",
    playerImageUrl: player?.playerImageUrl ?? null,
    playerImageTemplateUrl: player?.playerImageTemplateUrl ?? null,
    teamLogoUrl: team?.logoUrl ?? null,
    teamLogoTemplateUrl: team?.logoTemplateUrl ?? null,
    teamColor: team?.primaryColor ?? realGame.groupColor ?? "#8fe7ff",
    source: "HMS",
    gameDetailUrl: `https://prod.hms.wootera.net/embed/game?gameId=${item.gameId}&lang=cs`,
  };
});

// Ukázkové zápasy napodobují data, která později vždy přijdou z entity Group v HMS.
// SPORT je pouze vizuální aproximace podle dodaného náhledu; produkce použije přesný HEX z API.
const demoGroups = {
  KLASIK: { color: "#429BF7", logoUrl: null },
  SPORT: { color: "#554CF6", logoUrl: null },
  SUPER: { color: "#a454ff", logoUrl: null },
};

const withDemoGroup = (item) => ({
  ...item,
  groupColor: demoGroups[item.group]?.color ?? null,
  groupLogoUrl: demoGroups[item.group]?.logoUrl ?? null,
});

const demoItems = [
  { id: "demo-1", type: "HATTRICK", importance: 98, date: "2026-09-16", competition: "PHM Cup", season: "2026–2027", group: "SPORT", phase: "Základní část", venue: "Zimní stadion Centrum", sponsor: "GNB Chem", homeTeam: "Ice Wolves", awayTeam: "Predators", homeScore: 5, awayScore: 2, team: "Ice Wolves", player: "Jakub Veselý", teamColor: "#4b8dff", title: "Tři góly v jednom večeru", text: "Jakub Veselý zkompletoval hattrick a rozhodl zápas ve prospěch Ice Wolves.", facts: { goals: 3 }, source: "DEMO" },
  { id: "demo-2", type: "BIG_SAVES", importance: 82, date: "2026-09-15", competition: "PHM Cup", season: "2026–2027", group: "KLASIK", phase: "Základní část", venue: "Aréna Jih", sponsor: "Partner demo", homeTeam: "North Stars", awayTeam: "HC Meteor", homeScore: 2, awayScore: 1, team: "North Stars", player: "Daniel Král", teamColor: "#50d29a", title: "Čtyřicet zákroků", text: "Daniel Král zastavil 40 střel a udržel těsné vedení až do konce.", facts: { saves: 40 }, source: "DEMO" },
  { id: "demo-3", type: "EARLY_GOAL", importance: 75, date: "2026-09-14", competition: "PHM Cup", season: "2026–2027", group: "SUPER", phase: "Playoff", venue: "Aréna Sever", sponsor: "GNB Chem", homeTeam: "HC Tempo", awayTeam: "Vltava Crew", homeScore: 4, awayScore: 3, team: "Vltava Crew", player: "Pavel Mareš", teamColor: "#a454ff", title: "Gól po 29 sekundách", text: "Pavel Mareš otevřel skóre dřív, než se zápas stačil rozběhnout.", facts: { gameTime: "0:29" }, source: "DEMO" },
  { id: "demo-4", type: "MULTIPOINT_GAME", importance: 68, date: "2026-09-13", competition: "PHM Cup", season: "2025–2026", group: "SPORT", phase: "Playoff", venue: "Zimní stadion Centrum", sponsor: "Bez partnera", homeTeam: "Predators", awayTeam: "HC Tempo", homeScore: 6, awayScore: 4, team: "Predators", player: "Ondřej Malý", teamColor: "#ff5b62", title: "Čtyři body v play-off", text: "Ondřej Malý posbíral dva góly a dvě asistence.", facts: { points: 4 }, source: "DEMO" },
  { id: "demo-5", type: "BIG_WIN", importance: 91, date: "2026-09-12", competition: "PHM Cup", season: "2025–2026", group: "KLASIK", phase: "Základní část", venue: "Aréna Jih", sponsor: "Partner demo", homeTeam: "HC Meteor", awayTeam: "Ice Wolves", homeScore: 1, awayScore: 8, team: "Ice Wolves", player: "", teamColor: "#4b8dff", title: "Sedmibrankový rozdíl", text: "Ice Wolves ovládli utkání 8:1 a přidali nejvyšší výhru kola.", facts: { scoreDifference: 7 }, source: "DEMO" },
].map(withDemoGroup);

export const feedDemo = [...realItems, ...demoItems]
  .sort((a, b) => b.date.localeCompare(a.date) || b.importance - a.importance);
