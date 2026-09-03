-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy V2 — 0006 Disputes
--
--  Buyer protection. A customer can raise a problem against a delivered or
--  in-flight order; the seller responds; an admin resolves it. Resolving a
--  dispute in the customer's favour does not move money by itself — refunds
--  are recorded explicitly through public.record_refund (0004_payments.sql).
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.dispute_category as enum (
    'product_damaged', 'wrong_product', 'missing_product',
    'delivery_issue', 'seller_issue', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dispute_status as enum (
    'opened', 'under_review', 'seller_response', 'resolved', 'closed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.disputes (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  seller_id     uuid not null references public.sellers(id) on delete restrict,
  category      public.dispute_category not null,
  status        public.dispute_status not null default 'opened',
  description   text not null check (length(trim(description)) between 10 and 2000),
  seller_reply  text,
  resolution    text,
  resolved_by   uuid references public.profiles(id) on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists disputes_order_idx    on public.disputes(order_id);
create index if not exists disputes_seller_idx   on public.disputes(seller_id, status);
create index if not exists disputes_customer_idx on public.disputes(customer_id, created_at desc);

drop trigger if exists set_disputes_updated_at on public.disputes;
create trigger set_disputes_updated_at before update on public.disputes
  for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;
alter table public.disputes force row level security;
select public.drop_policies('disputes');

-- Only the three parties involved can see a dispute exists.
create policy "disputes: customer read own" on public.disputes
  for select using (auth.uid() = customer_id);

create policy "disputes: seller read own" on public.disputes
  for select using (auth.uid() = seller_id);

create policy "disputes: admin read" on public.disputes
  for select using (public.is_admin());

-- Writes go through the functions below so that status transitions, notices
-- and the audit trail stay consistent.

create or replace function public.open_dispute(
  p_order_id      uuid,
  p_order_item_id uuid,
  p_category      public.dispute_category,
  p_description   text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order  public.orders%rowtype;
  v_item   public.order_items%rowtype;
  v_id     uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.user_id <> auth.uid() then
    raise exception 'This order is not yours' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_description, ''))) < 10 then
    raise exception 'Please describe the problem in a little more detail' using errcode = '22023';
  end if;

  select * into v_item from public.order_items
   where id = p_order_item_id and order_id = p_order_id;
  if v_item.id is null then
    raise exception 'That item is not part of this order' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.disputes
    where order_item_id = p_order_item_id and status not in ('resolved', 'closed')
  ) then
    raise exception 'There is already an open case for this item' using errcode = 'P0001';
  end if;

  insert into public.disputes (
    order_id, order_item_id, customer_id, seller_id, category, description
  ) values (
    p_order_id, p_order_item_id, auth.uid(), v_item.seller_id, p_category, trim(p_description)
  )
  returning id into v_id;

  perform public.notify(
    v_item.seller_id, 'dispute.opened',
    'A customer reported a problem with ' || v_order.reference,
    left(trim(p_description), 140), '/seller');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'dispute.opened', 'dispute', v_id::text,
          jsonb_build_object('order', v_order.reference, 'category', p_category));

  return v_id;
end;
$$;

revoke all on function public.open_dispute(uuid, uuid, public.dispute_category, text) from public;
grant execute on function public.open_dispute(uuid, uuid, public.dispute_category, text) to authenticated;

create or replace function public.respond_to_dispute(p_dispute_id uuid, p_reply text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_dispute public.disputes%rowtype;
begin
  select * into v_dispute from public.disputes where id = p_dispute_id;
  if v_dispute.id is null then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;
  if v_dispute.seller_id <> auth.uid() then
    raise exception 'This case is not yours to answer' using errcode = '42501';
  end if;
  if v_dispute.status in ('resolved', 'closed') then
    raise exception 'This case is already closed' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reply, ''))) < 5 then
    raise exception 'Please write a reply' using errcode = '22023';
  end if;

  update public.disputes
     set seller_reply = trim(p_reply), status = 'seller_response'
   where id = p_dispute_id;

  perform public.notify(
    v_dispute.customer_id, 'dispute.response',
    'The seller replied to your case', left(trim(p_reply), 140), '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'dispute.seller_replied', 'dispute', p_dispute_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.respond_to_dispute(uuid, text) from public;
grant execute on function public.respond_to_dispute(uuid, text) to authenticated;

create or replace function public.resolve_dispute(
  p_dispute_id uuid,
  p_status public.dispute_status,
  p_resolution text
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_dispute public.disputes%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can resolve a case' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'resolved', 'closed') then
    raise exception 'Invalid resolution status' using errcode = '22023';
  end if;

  select * into v_dispute from public.disputes where id = p_dispute_id;
  if v_dispute.id is null then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;

  update public.disputes
     set status      = p_status,
         resolution  = nullif(trim(coalesce(p_resolution, '')), ''),
         resolved_by = case when p_status in ('resolved','closed') then auth.uid() else resolved_by end,
         resolved_at = case when p_status in ('resolved','closed') then now() else resolved_at end
   where id = p_dispute_id;

  perform public.notify(
    v_dispute.customer_id, 'dispute.updated',
    'Your case has been updated', nullif(trim(coalesce(p_resolution, '')), ''), '/orders');
  perform public.notify(
    v_dispute.seller_id, 'dispute.updated',
    'A case involving your store has been updated',
    nullif(trim(coalesce(p_resolution, '')), ''), '/seller');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'dispute.resolved', 'dispute', p_dispute_id::text,
          jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.resolve_dispute(uuid, public.dispute_status, text) from public;
grant execute on function public.resolve_dispute(uuid, public.dispute_status, text) to authenticated;
