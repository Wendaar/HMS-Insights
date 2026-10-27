begin;

alter table games
  add column if not exists score_was_overridden boolean not null default false;

alter table detected_priklepy
  drop constraint if exists detected_priklepy_type_check;

alter table detected_priklepy
  add constraint detected_priklepy_type_check check (type in (
    'BIG_WIN',
    'EARLY_GOAL',
    'MULTIPOINT_GAME',
    'HATTRICK',
    'BIG_SAVES',
    'TEAM_GOAL_MILESTONE',
    'COMEBACK_WIN',
    'SEASON_GOAL_MILESTONE',
    'SEASON_POINT_MILESTONE',
    'TEAM_WIN_STREAK',
    'TEAM_UNBEATEN_STREAK',
    'PLAYER_GOAL_STREAK'
  ));

create index if not exists player_game_stats_history_idx
  on player_game_stats (player_id, game_id);

create index if not exists team_game_stats_history_idx
  on team_game_stats (team_id, game_id);

commit;
