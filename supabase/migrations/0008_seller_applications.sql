alter table public.seller_documents
  drop constraint if exists seller_documents_doc_type_check;

alter table public.seller_documents
  add constraint seller_documents_doc_type_check
  check (doc_type in ('business_licence', 'identity', 'other'));

update public.seller_documents
   set doc_type = case
     when doc_type in ('business_licence', 'identity', 'other') then doc_type
     when doc_type = 'national_id' then 'identity'
     else 'other'
   end;

create or replace function public.apply_to_sell(
  p_store_name   text,
  p_description  text default null,
  p_momo_number  text default null,
  p_momo_name    text default null,
  p_bank_name    text default null,
  p_bank_account text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_existing public.sellers%rowtype;
  v_name     text := nullif(trim(coalesce(p_store_name, '')), '');
begin
  if v_user is null then
    raise exception 'You must be signed in to apply' using errcode = '42501';
  end if;
  if coalesce(public.auth_suspended(), false) then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 2 then
    raise exception 'A store name is required' using errcode = '22023';
  end if;
  if p_momo_number is not null and trim(p_momo_number) <> ''
     and trim(p_momo_number) !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a valid Mobile Money number' using errcode = '22023';
  end if;

  select * into v_existing from public.sellers where id = v_user;

  if v_existing.id is not null then
    if v_existing.status = 'approved' then
      raise exception 'You already sell on SwiftBuy' using errcode = 'P0001';
    end if;
    if v_existing.status = 'pending' then
      raise exception 'Your application is already under review' using errcode = 'P0001';
    end if;
    if v_existing.status = 'suspended' then
      raise exception 'Your store is suspended. Please contact SwiftBuy support.'
        using errcode = '42501';
    end if;
  end if;

  perform set_config('swiftbuy.internal', 'on', true);

  insert into public.sellers (
    id, store_name, description, status, status_reason,
    momo_number, momo_name, bank_name, bank_account
  ) values (
    v_user, v_name,
    nullif(trim(coalesce(p_description, '')), ''),
    'pending', null,
    nullif(trim(coalesce(p_momo_number, '')), ''),
    nullif(trim(coalesce(p_momo_name, '')), ''),
    nullif(trim(coalesce(p_bank_name, '')), ''),
    nullif(trim(coalesce(p_bank_account, '')), '')
  )
  on conflict (id) do update set
    store_name    = excluded.store_name,
    description   = excluded.description,
    status        = 'pending',
    status_reason = null,
    momo_number   = excluded.momo_number,
    momo_name     = excluded.momo_name,
    bank_name     = excluded.bank_name,
    bank_account  = excluded.bank_account;

  perform set_config('swiftbuy.internal', 'off', true);

  perform public.notify(
    v_user, 'seller.applied', 'Your seller application has been submitted',
    'A SwiftBuy administrator will review it and let you know the outcome.',
    '/sell/apply');

  perform public.notify(
    staff.id, 'seller.application_received',
    'New seller application: ' || v_name,
    'Review the store details and verification documents before deciding.',
    '/admin')
  from (select id from public.profiles where role in ('admin', 'superadmin')) staff;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'seller.applied', 'seller', v_user::text,
          jsonb_build_object('store_name', v_name,
                             'reapplied', v_existing.id is not null));

  return v_user;
end;
$$;

revoke all on function public.apply_to_sell(text, text, text, text, text, text) from public;
grant execute on function public.apply_to_sell(text, text, text, text, text, text) to authenticated;

create or replace function public.my_seller_application()
returns table (
  seller_id     uuid,
  store_name    text,
  description   text,
  status        public.seller_status,
  status_reason text,
  momo_number   text,
  momo_name     text,
  bank_name     text,
  bank_account  text,
  applied_at    timestamptz,
  approved_at   timestamptz,
  document_count int
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.store_name, s.description, s.status, s.status_reason,
    s.momo_number, s.momo_name, s.bank_name, s.bank_account,
    s.created_at, s.approved_at,
    (select count(*)::int from public.seller_documents d where d.seller_id = s.id)
  from public.sellers s
  where s.id = auth.uid()
$$;

revoke all on function public.my_seller_application() from public;
grant execute on function public.my_seller_application() to authenticated;

create or replace function public.seller_application_documents(p_seller_id uuid)
returns table (
  id           uuid,
  doc_type     text,
  storage_path text,
  file_name    text,
  reviewed_at  timestamptz,
  created_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select d.id, d.doc_type, d.storage_path, d.file_name, d.reviewed_at, d.created_at
  from public.seller_documents d
  where d.seller_id = p_seller_id
    and (public.is_admin() or d.seller_id = auth.uid())
  order by d.created_at desc
$$;

revoke all on function public.seller_application_documents(uuid) from public;
grant execute on function public.seller_application_documents(uuid) to authenticated;
