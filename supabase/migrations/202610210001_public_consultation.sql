begin;

-- Restore anonymous reading of published catalog entries. Existing permissive
-- policies still require publication; private schemas and write policies stay intact.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'catalog_players', 'catalog_clubs', 'catalog_federations',
    'catalog_staff', 'catalog_participants', 'catalog_milestones'
  ] loop
    execute format('drop policy if exists registered_consultation on public.%I', table_name);
  end loop;
end $$;

-- Keep the installed return columns and published-player filter in the public
-- trajectory function, removing only the additional registered-account gate.
do $$
declare target record; definition text;
begin
  select p.oid, p.prosrc, l.lanname, p.proretset into strict target
  from pg_proc p join pg_language l on l.oid = p.prolang
  where p.oid = 'public.player_trajectory_public(text)'::regprocedure;
  if target.lanname <> 'sql' or not target.proretset then
    raise exception 'Unexpected trajectory function; review before changing it.';
  end if;
  if position('public.app_has_consultation_access()' in target.prosrc) > 0 then
    definition := pg_get_functiondef(target.oid);
    execute replace(definition, target.prosrc,
      replace(target.prosrc, 'public.app_has_consultation_access()', 'true'));
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
