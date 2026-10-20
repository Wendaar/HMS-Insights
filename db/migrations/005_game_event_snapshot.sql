begin;

-- Nullable: earlier imports must remain readable without invented event history.
alter table games add column if not exists event_snapshot jsonb;
comment on column games.event_snapshot is
  'Versioned allowlisted goals, assists, penalties and saves plus source collection availability. No raw HMS responses.';

commit;
