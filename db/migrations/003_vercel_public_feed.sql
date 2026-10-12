begin;

alter table games
  add column if not exists competition_name text,
  add column if not exists season_name text,
  add column if not exists group_name text,
  add column if not exists phase_name text;

create or replace view public_priklepy_feed as
select
  p.priklep_id,
  p.type,
  p.importance,
  p.title,
  p.body,
  p.facts,
  p.game_id,
  p.player_id,
  p.team_id,
  p.sponsor_name,
  p.sponsor_logo_url,
  g.played_on,
  g.competition_name,
  g.season_name,
  g.group_name,
  g.group_color,
  g.group_logo_url,
  g.phase_name,
  g.venue_name,
  g.venue_logo_url,
  g.home_team_name,
  g.away_team_name,
  g.home_score,
  g.away_score,
  coalesce(ps.player_name, gs.player_name) as player_name,
  coalesce(ps.player_image_url, gs.player_image_url) as player_image_url,
  ts.team_name,
  ts.team_logo_url,
  coalesce(ts.primary_color, ts.secondary_color) as team_color
from detected_priklepy p
join games g on g.game_id = p.game_id
left join player_game_stats ps on ps.game_id = p.game_id and ps.player_id = p.player_id
left join goalie_game_stats gs on gs.game_id = p.game_id and gs.player_id = p.player_id
left join team_game_stats ts on ts.game_id = p.game_id and ts.team_id = p.team_id;

comment on view public_priklepy_feed is
  'Veřejný, očištěný výstup Příklepů bez kontaktních a dalších nepotřebných osobních údajů.';

commit;
