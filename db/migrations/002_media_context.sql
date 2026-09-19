begin;

alter table games
  add column if not exists group_color text,
  add column if not exists group_logo_url text,
  add column if not exists venue_id uuid,
  add column if not exists venue_name text,
  add column if not exists venue_logo_url text;

alter table player_game_stats
  add column if not exists player_image_url text,
  add column if not exists player_image_template_url text;

alter table goalie_game_stats
  add column if not exists player_image_url text,
  add column if not exists player_image_template_url text;

alter table team_game_stats
  add column if not exists team_logo_url text,
  add column if not exists team_logo_template_url text,
  add column if not exists primary_color text,
  add column if not exists secondary_color text;

alter table detected_priklepy
  add column if not exists sponsor_id uuid,
  add column if not exists sponsor_name text,
  add column if not exists sponsor_logo_url text;

commit;
