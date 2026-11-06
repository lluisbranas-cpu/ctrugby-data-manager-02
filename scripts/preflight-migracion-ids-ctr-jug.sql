-- PRE-FLIGHT ONLY. All statements are read-only.
-- DO NOT run a CTR -> JUG update until backup, mapping and code/storage audits pass.
-- Target Supabase project: ycppheupweprkyinhwfu
-- Run as database owner in SQL Editor. Does not change any records.

-- 1. Total, prefix distribution and current visibility.
select count(*) as total,
       count(*) filter (where id ~ '^CTR[0-9]{4}$') as ctr,
       count(*) filter (where id ~ '^JUG[0-9]{4}$') as jug,
       count(*) filter (where published) as published
from public.catalog_players;

-- 2. Deterministic target uniqueness and collisions. A safe numerical mapping
-- is NOT proof that two person records with equal suffix represent the same person.
with mapping as (
  select p.id as source_id, 'JUG' || substring(p.id from 4) as target_id
  from public.catalog_players p
  where p.id ~ '^CTR[0-9]{4}$'
)
select count(*) as candidates,
       count(distinct target_id) as unique_targets,
       count(*) filter (where exists (
         select 1 from public.catalog_players other where other.id = mapping.target_id
       )) as existing_target_collisions
from mapping;

-- 3. Missing/irregular identifiers, including the intentionally unresolved CTR0381.
select id, first_name, last_name, published
from public.catalog_players
where id !~ '^CTR[0-9]{4}$' or id in ('CTR0381')
order by id;

-- 4. Every FK referencing the player PK. Keep and review ON DELETE semantics.
select conrelid::regclass::text as source_table,
       conname as constraint_name,
       condeferrable, condeferred,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f' and confrelid = 'public.catalog_players'::regclass
order by 1,2;

-- 5. All candidate references, including columns without FK constraints.
select table_schema,table_name,column_name,data_type
from information_schema.columns
where table_schema in ('public','app_private')
  and (column_name in ('id','player_id','participant_id','storage_key')
       or column_name like '%player%id%')
order by 1,2,3;

-- 6. Row counts in player-linked relations (read-only metadata estimates;
-- exact counts will be required in the migration transaction).
select n.nspname as schema_name,c.relname as relation_name,
       c.reltuples::bigint as estimated_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public','app_private')
  and c.relkind = 'r'
  and (c.relname like '%player%' or c.relname like '%participant%'
       or c.relname like '%consent%' or c.relname like '%assessment%')
order by 1,2;

-- 7. Functions whose interfaces or implementations could be affected.
select n.nspname as function_schema,
       p.oid::regprocedure::text as signature
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app_private') and p.prokind = 'f'
  and (p.proname like '%player%' or p.proname like '%likidhub%'
       or p.proname like '%club%')
order by 1,2;

-- 8. Triggers on catalog tables and private player tables.
select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','app_private')
  and (c.relname like '%player%' or c.relname like '%participant%')
order by 1,2,3;

-- 9. Storage objects with CTR identifiers in their paths. Metadata only.
select bucket_id,
       count(*) as ctr_objects,
       count(*) filter(where name ~ '(^|/)CTR0381(/|[.\\-]|$)') as ctr0381_objects
from storage.objects
where name ~ 'CTR[0-9]{4}'
group by bucket_id
order by bucket_id;
