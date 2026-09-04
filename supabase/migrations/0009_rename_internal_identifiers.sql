do $$
declare r record;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosrc like '%swiftbuy.internal%'
  loop
    execute replace(
      pg_get_functiondef(r.oid),
      'swiftbuy.internal',
      'shop_mumu.internal'
    );
  end loop;
end $$;

do $$
declare
  r      record;
  target text;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'swiftbuy:%'
  loop
    target := 'shop_mumu:' || substr(r.policyname, length('swiftbuy:') + 1);

    if exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = target
    ) then
      execute format('drop policy %I on storage.objects', r.policyname);
    else
      execute format(
        'alter policy %I on storage.objects rename to %I',
        r.policyname, target
      );
    end if;
  end loop;
end $$;

do $$
declare leftover int;
begin
  select count(*) into leftover
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%swiftbuy.internal%';

  if leftover > 0 then
    raise exception 'Rename incomplete: % function(s) still read swiftbuy.internal', leftover;
  end if;

  select count(*) into leftover
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'swiftbuy:%';

  if leftover > 0 then
    raise exception 'Rename incomplete: % storage policy(ies) still named swiftbuy:%%', leftover;
  end if;
end $$;
