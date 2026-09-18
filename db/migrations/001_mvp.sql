begin;

create table if not exists games (
  game_id uuid primary key,
  organization_id uuid not null,
  competition_id uuid not null,
  season_id uuid not null,
  group_id uuid not null,
  phase_id uuid not null,
  status text not null check (status = 'FINISHED'),
  played_on date not null,
  started_at timestamp not null,
  home_team_id uuid not null,
  away_team_id uuid not null,
  home_team_name text not null,
  away_team_name text not null,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_game_stats (
  game_id uuid not null references games(game_id) on delete cascade,
  player_id uuid not null,
  team_id uuid not null,
  player_name text not null,
  goals integer not null default 0 check (goals >= 0),
  assists integer not null default 0 check (assists >= 0),
  points integer generated always as (goals + assists) stored,
  pim integer not null default 0 check (pim >= 0),
  primary key (game_id, player_id)
);

create table if not exists goalie_game_stats (
  game_id uuid not null references games(game_id) on delete cascade,
  player_id uuid not null,
  team_id uuid not null,
  player_name text not null,
  saves integer not null default 0 check (saves >= 0),
  goals_against integer not null default 0 check (goals_against >= 0),
  primary key (game_id, player_id)
);

create table if not exists team_game_stats (
  game_id uuid not null references games(game_id) on delete cascade,
  team_id uuid not null,
  team_name text not null,
  side text not null check (side in ('HOME', 'AWAY')),
  goals integer not null check (goals >= 0),
  goals_against integer not null check (goals_against >= 0),
  score_difference integer not null,
  lineup_size integer not null check (lineup_size >= 0),
  result text not null check (result in ('WIN', 'LOSS', 'DRAW')),
  primary key (game_id, team_id)
);

create table if not exists detected_priklepy (
  priklep_id text primary key,
  organization_id uuid not null,
  competition_id uuid not null,
  season_id uuid not null,
  group_id uuid not null,
  game_id uuid not null references games(game_id) on delete cascade,
  type text not null check (type in ('BIG_WIN', 'EARLY_GOAL', 'MULTIPOINT_GAME', 'HATTRICK', 'BIG_SAVES')),
  player_id uuid,
  team_id uuid,
  importance smallint not null check (importance between 0 and 100),
  title text not null,
  body text not null,
  facts jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);

create index if not exists games_tenant_idx
  on games (organization_id, competition_id, season_id, group_id, played_on desc);
create index if not exists priklepy_feed_idx
  on detected_priklepy (organization_id, competition_id, season_id, group_id, importance desc);
create index if not exists priklepy_game_idx on detected_priklepy (game_id);

commit;

