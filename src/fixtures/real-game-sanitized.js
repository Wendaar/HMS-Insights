const ids = {
  game: "F6312E3A-98CA-11F1-8BDF-EF2495D048F3",
  org: "BB669217-41EB-4162-8040-A73F49A43570",
  competition: "C7C0BB15-5D29-415D-851E-5D777C6CC621",
  season: "E6134160-47CF-11F1-A223-BFDFBDD3A64B",
  group: "4A4E9670-47D0-11F1-A223-BFDFBDD3A64B",
  phase: "C800E560-869F-11F1-BDD5-8958B510B6A2",
  home: "9039B940-3CB3-11F0-B991-9FDE3B856598",
  away: "DDEF06E1-1A37-460A-9B1F-5EAF753DBC87",
};

const roster = [
  ["1EDD37B0-6C37-11EF-89FD-0DB42F920004", "Karel", "Škrdle", ids.away, 2, false],
  ["8CDB48D0-7C29-11F0-A8E9-11BC5ED30179", "Aleš", "Kolaja", ids.away, 17, false],
  ["8C0F3B37-9DF3-455F-9F16-2D2E99962926", "Adam", "Prokop", ids.away, 9, false],
  ["FA36A389-39F7-439B-8B11-3681A7F365F6", "Matyáš", "Hrubý", ids.away, 24, false],
  ["E1EF9BC0-2938-11F1-87D4-4B973A935FDA", "Martin", "Šimánek", ids.away, 27, false],
  ["F4F5D9C6-B405-4B68-B366-53DCB40D2900", "Aleš", "Hadrbolec", ids.away, 79, true],
  ["C9F99BC0-2CDA-439F-BC0D-59382B9E32E0", "Mansur", "Ischoev", ids.away, 92, false],
  ["94D1C60A-77AE-48FF-8865-7390878719BF", "David", "Mekleš", ids.away, 25, false],
  ["C4DB4981-75AF-46F6-B7A8-76D6E65F3BE8", "Ladislav", "Kolář", ids.away, 87, false],
  ["8B6895B0-ABED-11EE-95AD-91D90C299F63", "David", "Polomis", ids.away, 12, false],
  ["A8349F20-4D99-11EE-8524-A9104A12EF21", "Michal", "Ježek", ids.away, 3, false],
  ["126FC9E0-A842-11F1-AD56-B347AFCE5B1F", "Tomáš", "Novák", ids.away, 8, false],
  ["A087D9A1-8C88-425A-9C06-B7B2008B1EAE", "Tomáš", "Prokop", ids.away, 15, false],
  ["50B972A0-895D-11F0-A03E-CF351A4C268C", "Marek", "Pechr", ids.away, 32, false],
  ["6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826", "Marek", "Horáček", ids.home, 11, false],
  ["3E7C1B50-88BE-11F0-B6C8-8587139C7349", "Martin", "Vostárek", ids.home, 9, false],
  ["9A532590-5196-11F0-A6FC-87BBDED477B1", "Jan", "Šramota", ids.home, 24, false],
  ["488E6710-51C3-11F0-A6FC-87BBDED477B1", "Lukáš", "Novák", ids.home, 48, false],
  ["38BDAD40-51C4-11F0-A6FC-87BBDED477B1", "Radim", "Červený", ids.home, 46, false],
  ["B21803C0-51C9-11F0-A6FC-87BBDED477B1", "Filip", "Švaříček", ids.home, 12, false],
  ["6C483630-51CE-11F0-A6FC-87BBDED477B1", "Šimon", "Boček", ids.home, 49, false],
  ["DDC06A60-8695-11F1-BDD5-8958B510B6A2", "Stanislav", "Olmr", ids.home, 13, false],
  ["9954EE3F-C703-4E1F-9C4E-D192CB5566E0", "Jan", "Urych", ids.home, 3, false],
  ["31416E10-99C6-11EE-A083-D573B186FF81", "Petr", "Lukášek", ids.home, 1, true],
  ["AB8AE430-C54D-488A-A569-FC76EB269F13", "David", "Kulich", ids.home, 7, false],
];

const byId = new Map(roster.map(([id, firstName, lastName, teamId]) => [id, { playerId: id, firstName, lastName, teamId }]));
const playerMedia = {
  "F4F5D9C6-B405-4B68-B366-53DCB40D2900": {
    avatarUrl: "https://hockeymanagementsystem.s3.amazonaws.com/images/avatars/2022-09-03-iw3ej-hadrbolec-ales-kos-avatar.webp",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_ALES_HADRBOLEC_UMaXFQ8qs9hO_[size]",
  },
  "C9F99BC0-2CDA-439F-BC0D-59382B9E32E0": {
    avatarUrl: "https://drive.google.com/uc?export=view&id=1WoqDR8Owt61rnrR_TvrGfOAEoeoxWAHq",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_MANSUR_ISCHOEV_0iJ6GQ59VpoG_[size]",
  },
  "6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826": {
    avatarUrl: "https://drive.google.com/thumbnail?id=1tcXWEnrDjOESyEVtq-Cw9wnhowPTUpom",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_MAREK_HORACEK_0LWnqHPbhFaM_[size]",
  },
  "3E7C1B50-88BE-11F0-B6C8-8587139C7349": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_MARTIN_VOSTAREK_mfYU0OkMVGF6_[size]",
  },
  "9A532590-5196-11F0-A6FC-87BBDED477B1": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_JAN_SRAMOTA_Y0aJk8kytIuh_[size]",
  },
  "488E6710-51C3-11F0-A6FC-87BBDED477B1": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_LUKAS_NOVAK_YPxcn6KGjAE4_[size]",
  },
  "38BDAD40-51C4-11F0-A6FC-87BBDED477B1": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_RADIM_CERVENY_tKS43rmQrATl_[size]",
  },
  "B21803C0-51C9-11F0-A6FC-87BBDED477B1": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_FILIP_SVARICEK_uhuBqPh0yqyE_[size]",
  },
  "9954EE3F-C703-4E1F-9C4E-D192CB5566E0": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_JAN_URYCH_IEySFiax0sQT_[size]",
  },
  "31416E10-99C6-11EE-A083-D573B186FF81": {
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_PETR_LUKASEK_3jqUm02WUCUg_[size]",
  },
  "A087D9A1-8C88-425A-9C06-B7B2008B1EAE": {
    avatarUrl: "https://hockeymanagementsystem.s3.amazonaws.com/images/avatars/2022-10-09-n4800-tom---prokop.webp",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_TOMAS_PROKOP_53wvLYigOUaB_[size]",
  },
  "AB8AE430-C54D-488A-A569-FC76EB269F13": {
    avatarUrl: "https://drive.google.com/uc?export=view&id=1j7AwAyUTIco5S05Bz6JnRU4FlLxjs3P2",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Player_DAVID_KULICH_e78pLHw5eDyf_[size]",
  },
};
const teams = {
  [ids.home]: {
    teamId: ids.home,
    name: "PUK PAK PIVO",
    logo: null,
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Team_PUK_PAK_PIVO_Jj6IxJHme3EM_[size]",
    teamColor1: null,
    teamColor2: null,
    jerseyColor1: "#ffffff",
  },
  [ids.away]: {
    teamId: ids.away,
    name: "HC Kosti",
    logo: "https://drive.google.com/thumbnail?id=1yhsW3msPl1CeNU0L0nJwwUtYrh58FpzV",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Team_HC_KOSTI_IVpg5MIlQ6sx_[size]",
    teamColor1: "#ffeb3b",
    teamColor2: "#000000",
    jerseyColor1: "#ffeb3b",
  },
};

const goalRows = [
  ["0:43", "C9F99BC0-2CDA-439F-BC0D-59382B9E32E0", ids.away, "FA36A389-39F7-439B-8B11-3681A7F365F6", "E1EF9BC0-2938-11F1-87D4-4B973A935FDA", "31416E10-99C6-11EE-A083-D573B186FF81"],
  ["7:18", "AB8AE430-C54D-488A-A569-FC76EB269F13", ids.home, "9A532590-5196-11F0-A6FC-87BBDED477B1", "6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["7:48", "6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826", ids.home, "B21803C0-51C9-11F0-A6FC-87BBDED477B1", null, "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["11:20", "AB8AE430-C54D-488A-A569-FC76EB269F13", ids.home, "9954EE3F-C703-4E1F-9C4E-D192CB5566E0", null, "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["14:35", "488E6710-51C3-11F0-A6FC-87BBDED477B1", ids.home, "AB8AE430-C54D-488A-A569-FC76EB269F13", "6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["20:00", "B21803C0-51C9-11F0-A6FC-87BBDED477B1", ids.home, "DDC06A60-8695-11F1-BDD5-8958B510B6A2", "38BDAD40-51C4-11F0-A6FC-87BBDED477B1", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["24:39", "3E7C1B50-88BE-11F0-B6C8-8587139C7349", ids.home, "9A532590-5196-11F0-A6FC-87BBDED477B1", "6AFF20FA-CA8A-439B-AD60-7DDDD0F9E826", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["26:21", "9954EE3F-C703-4E1F-9C4E-D192CB5566E0", ids.home, "38BDAD40-51C4-11F0-A6FC-87BBDED477B1", null, "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["35:12", "C4DB4981-75AF-46F6-B7A8-76D6E65F3BE8", ids.away, "1EDD37B0-6C37-11EF-89FD-0DB42F920004", "A8349F20-4D99-11EE-8524-A9104A12EF21", "31416E10-99C6-11EE-A083-D573B186FF81"],
  ["39:58", "C9F99BC0-2CDA-439F-BC0D-59382B9E32E0", ids.away, "E1EF9BC0-2938-11F1-87D4-4B973A935FDA", "FA36A389-39F7-439B-8B11-3681A7F365F6", "31416E10-99C6-11EE-A083-D573B186FF81"],
  ["36:58", "9A532590-5196-11F0-A6FC-87BBDED477B1", ids.home, "3E7C1B50-88BE-11F0-B6C8-8587139C7349", "B21803C0-51C9-11F0-A6FC-87BBDED477B1", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
  ["41:42", "488E6710-51C3-11F0-A6FC-87BBDED477B1", ids.home, "9954EE3F-C703-4E1F-9C4E-D192CB5566E0", "38BDAD40-51C4-11F0-A6FC-87BBDED477B1", "F4F5D9C6-B405-4B68-B366-53DCB40D2900"],
];

export const lineupResponse = {
  gameId: ids.game,
  Lineups: roster.map(([playerId, firstName, lastName, teamId, number, isGoalie], index) => ({
    lineupId: `fixture-lineup-${index + 1}`,
    name: `${teams[teamId].name} - ${number}`,
    number,
    isDeleted: false,
    gameId: ids.game,
    playerId,
    teamId,
    Player: { playerId, firstName, lastName, ...(playerMedia[playerId] ?? {}) },
    ListPosition: { name: isGoalie ? "Gólman" : "Hráč", isGoalie },
  })),
  Phase: {
    phaseId: ids.phase,
    name: "Základní část",
    Group: {
      groupId: ids.group,
      name: "SUPER",
      color: "#a454ff",
      logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Group_SUPER_B8dRbKtt6SQX_[size]",
      Season: {
        seasonId: ids.season,
        name: "2026–2027",
        Competition: { competitionId: ids.competition, name: "PHM Cup" },
      },
    },
  },
  Venue: {
    venueId: "8F636684-2091-4209-BA3B-23E9134FBF38",
    name: "ICERINK (Yellow)",
    logoUrl: "https://prod-hms-wootera.s3.eu-central-1.amazonaws.com/Venue_ICERINK_YELLOW_ohKAiiq5jruu_[size]",
  },
};

const goals = goalRows.map(([gameTime, scorerId, teamId, a1, a2, goalieId], index) => ({
  gameEventGoalId: `fixture-goal-${index + 1}`,
  gameTime,
  period: Number(gameTime.split(":")[0]) < 15 ? "1. Třetina" : Number(gameTime.split(":")[0]) < 30 ? "2. Třetina" : "3. Třetina",
  gameId: ids.game,
  isDeleted: false,
  scoredByPlayerId: scorerId,
  scoredByTeamId: teamId,
  assistedBy1PlayerId: a1,
  assistedBy2PlayerId: a2,
  allowedByPlayerId: goalieId,
  ScoredByPlayer: byId.get(scorerId),
  ScoredByTeam: teams[teamId],
  AssistedBy1Player: byId.get(a1),
  AssistedBy2Player: byId.get(a2),
  AllowedByPlayer: byId.get(goalieId),
}));

function saves(goalieId, teamId, count) {
  return Array.from({ length: count }, (_, index) => ({
    gameEventSaveId: `fixture-save-${goalieId}-${index + 1}`,
    gameId: ids.game,
    gameTime: "0:00",
    isDeleted: false,
    savedByPlayerId: goalieId,
    savedByTeamId: teamId,
    SavedByPlayer: byId.get(goalieId),
    SavedByTeam: teams[teamId],
  }));
}

export const gameEventsResponse = {
  gameId: ids.game,
  name: "PPP vs KOS",
  startDate: "2026-09-17",
  endDate: "2026-09-17",
  startTime: "20:15:00",
  status: "FINISHED",
  organizationId: ids.org,
  phaseId: ids.phase,
  homeTeamId: ids.home,
  awayTeamId: ids.away,
  GameEventGoals: goals,
  GameEventSaves: [
    ...saves("31416E10-99C6-11EE-A083-D573B186FF81", ids.home, 31),
    ...saves("F4F5D9C6-B405-4B68-B366-53DCB40D2900", ids.away, 34),
  ],
  GameEventPenalties: [],
};

export { ids };
