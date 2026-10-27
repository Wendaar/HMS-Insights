begin;

create table if not exists pregame_rankings (
  game_id uuid primary key,
  organization_id uuid not null,
  competition_id uuid not null,
  season_id uuid not null,
  group_id uuid,
  phase_id uuid,
  scheduled_on date not null,
  scheduled_time time,
  home_team_id uuid not null,
  away_team_id uuid not null,
  home_rank smallint not null check (home_rank > 0),
  away_rank smallint not null check (away_rank > 0),
  home_points numeric,
  away_points numeric,
  home_games smallint check (home_games >= 0),
  away_games smallint check (away_games >= 0),
  captured_at timestamptz not null default now(),
  source text not null default 'HMS' check (source = 'HMS')
);

create index if not exists pregame_rankings_scope_idx
  on pregame_rankings (organization_id, season_id, group_id, scheduled_on);

alter table detected_priklepy drop constraint if exists detected_priklepy_type_check;
alter table detected_priklepy add constraint detected_priklepy_type_check check (type in (
  'BIG_WIN', 'EARLY_GOAL', 'MULTIPOINT_GAME', 'HATTRICK', 'BIG_SAVES',
  'TEAM_GOAL_MILESTONE', 'COMEBACK_WIN', 'SEASON_GOAL_MILESTONE',
  'SEASON_POINT_MILESTONE', 'TEAM_WIN_STREAK', 'TEAM_UNBEATEN_STREAK',
  'PLAYER_GOAL_STREAK', 'RANK_UPSET'
));

commit;
