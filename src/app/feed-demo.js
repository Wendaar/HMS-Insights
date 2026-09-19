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
    phase: realGame.phaseName,
    venue: "Aréna Sever",
    sponsor: "Bez partnera",
    homeTeam: home.teamName,
    awayTeam: away.teamName,
    homeScore: realGame.homeScore,
    awayScore: realGame.awayScore,
    team: team?.teamName ?? "",
    player: player?.playerName ?? "",
    source: "HMS",
  };
});

const demoItems = [
  { id: "demo-1", type: "HATTRICK", importance: 98, date: "2026-09-16", competition: "PHM Cup", season: "2026–2027", group: "SPORT", phase: "Základní část", venue: "Zimní stadion Centrum", sponsor: "GNB Chem", homeTeam: "Ice Wolves", awayTeam: "Predators", homeScore: 5, awayScore: 2, team: "Ice Wolves", player: "Jakub Veselý", title: "Tři góly v jednom večeru", text: "Jakub Veselý zkompletoval hattrick a rozhodl zápas ve prospěch Ice Wolves.", source: "DEMO" },
  { id: "demo-2", type: "BIG_SAVES", importance: 82, date: "2026-09-15", competition: "PHM Cup", season: "2026–2027", group: "KLASIK", phase: "Základní část", venue: "Aréna Jih", sponsor: "Partner demo", homeTeam: "North Stars", awayTeam: "HC Meteor", homeScore: 2, awayScore: 1, team: "North Stars", player: "Daniel Král", title: "Čtyřicet zákroků", text: "Daniel Král zastavil 40 střel a udržel těsné vedení až do konce.", source: "DEMO" },
  { id: "demo-3", type: "EARLY_GOAL", importance: 75, date: "2026-09-14", competition: "PHM Cup", season: "2026–2027", group: "SUPER", phase: "Playoff", venue: "Aréna Sever", sponsor: "GNB Chem", homeTeam: "HC Tempo", awayTeam: "Vltava Crew", homeScore: 4, awayScore: 3, team: "Vltava Crew", player: "Pavel Mareš", title: "Gól po 29 sekundách", text: "Pavel Mareš otevřel skóre dřív, než se zápas stačil rozběhnout.", source: "DEMO" },
  { id: "demo-4", type: "MULTIPOINT_GAME", importance: 68, date: "2026-09-13", competition: "PHM Cup", season: "2025–2026", group: "SPORT", phase: "Playoff", venue: "Zimní stadion Centrum", sponsor: "Bez partnera", homeTeam: "Predators", awayTeam: "HC Tempo", homeScore: 6, awayScore: 4, team: "Predators", player: "Ondřej Malý", title: "Čtyři body v play-off", text: "Ondřej Malý posbíral dva góly a dvě asistence.", source: "DEMO" },
  { id: "demo-5", type: "BIG_WIN", importance: 91, date: "2026-09-12", competition: "PHM Cup", season: "2025–2026", group: "KLASIK", phase: "Základní část", venue: "Aréna Jih", sponsor: "Partner demo", homeTeam: "HC Meteor", awayTeam: "Ice Wolves", homeScore: 1, awayScore: 8, team: "Ice Wolves", player: "", title: "Sedmibrankový rozdíl", text: "Ice Wolves ovládli utkání 8:1 a přidali nejvyšší výhru kola.", source: "DEMO" },
];

export const feedDemo = [...realItems, ...demoItems]
  .sort((a, b) => b.importance - a.importance || b.date.localeCompare(a.date));
