begin;

alter table player_game_stats
  alter column pim type numeric(10,6) using pim::numeric;

comment on column player_game_stats.pim is
  'Součet trestných minut; podporuje i organizace s délkami trestů jako 1:45.';

commit;
