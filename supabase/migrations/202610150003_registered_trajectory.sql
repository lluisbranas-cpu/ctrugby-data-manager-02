begin;
-- Preserve the installed trajectory return columns while adding the registration gate.
do $$
declare target record; definition text; guarded text;
begin
  select p.oid,p.prosrc,l.lanname,p.proretset into strict target
  from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid='public.player_trajectory_public(text)'::regprocedure;
  if target.lanname <> 'sql' or not target.proretset then
    raise exception 'Unexpected trajectory function; review before changing it.';
  end if;
  if position('app_has_consultation_access()' in target.prosrc)=0 then
    definition:=pg_get_functiondef(target.oid);
    guarded:=format('select * from (%s) as registered_result where public.app_has_consultation_access()',rtrim(target.prosrc,E'; \n\r\t'));
    execute replace(definition,target.prosrc,guarded);
  end if;
end $$;
notify pgrst,'reload schema';
commit;
