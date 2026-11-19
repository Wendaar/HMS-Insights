-- Apply after 006_tool_instances.sql. No new data store or public schema.
-- Approved history is append-only even if a later application bug bypasses locks.
create or replace function hms_guard_closing_history() returns trigger language plpgsql as $$
declare previous jsonb; upcoming jsonb; n integer;
begin
 if OLD.tool not in ('official-closing','official-closing-preview') then
  if TG_OP='DELETE' then return OLD; else return NEW; end if;
 end if;
 previous := coalesce(OLD.draft->'versions','[]'::jsonb);
 if TG_OP='DELETE' then
  if jsonb_array_length(previous)>0 then raise exception 'Approved Closing history is immutable'; end if;
  return OLD;
 end if;
 if NEW.tool<>OLD.tool or NEW.organization<>OLD.organization or NEW.slug<>OLD.slug then
  raise exception 'Closing identity is immutable';
 end if;
 upcoming := coalesce(NEW.draft->'versions','[]'::jsonb);
 n := jsonb_array_length(previous);
 if jsonb_typeof(upcoming)<>'array' or jsonb_array_length(upcoming)<n or jsonb_array_length(upcoming)>n+1 then
  raise exception 'Invalid Closing history append';
 end if;
 for i in 0..n-1 loop
  if upcoming->i is distinct from previous->i then raise exception 'Approved Closing snapshot is immutable'; end if;
 end loop;
 return NEW;
end $$;
drop trigger if exists hms_closing_history_guard on hms_tool_instances;
create trigger hms_closing_history_guard before update or delete on hms_tool_instances
 for each row execute function hms_guard_closing_history();
