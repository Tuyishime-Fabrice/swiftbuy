create or replace function public.declare_payment(
  p_order_id uuid,
  p_customer_reference text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order   public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.user_id <> auth.uid() then
    raise exception 'This order is not yours' using errcode = '42501';
  end if;

  select * into v_payment from public.payments
   where order_id = p_order_id
   order by created_at desc limit 1;

  if v_payment.id is null then
    raise exception 'No payment is open for this order' using errcode = 'P0002';
  end if;
  if v_payment.status = 'successful' then
    raise exception 'This order has already been paid' using errcode = 'P0001';
  end if;
  if v_payment.status not in ('pending', 'initiated', 'failed') then
    raise exception 'A payment confirmation is already in progress' using errcode = 'P0001';
  end if;
  if v_payment.provider in ('manual_momo', 'manual_bank')
     and length(trim(coalesce(p_customer_reference, ''))) < 4 then
    raise exception 'Enter the transaction reference from your payment confirmation'
      using errcode = '22023';
  end if;

  perform set_config('shop_mumu.internal', 'on', true);
  update public.payments
     set status = case when provider = 'cash_on_delivery'
                       then 'initiated'::public.payment_status
                       else 'awaiting_confirmation'::public.payment_status end,
         customer_reference = nullif(trim(coalesce(p_customer_reference, '')), ''),
         failure_reason = null
   where id = v_payment.id;
  perform set_config('shop_mumu.internal', 'off', true);

  perform public.notify(
    oi.seller_id, 'payment.declared',
    'Payment declared for ' || v_order.reference,
    case when v_payment.provider = 'cash_on_delivery'
         then 'The customer chose cash on delivery.'
         else 'The customer says they have paid. Please verify and confirm.' end,
    '/seller')
  from (select distinct seller_id from public.order_items where order_id = p_order_id) oi;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.declared', 'payment', v_payment.id::text,
          jsonb_build_object('provider', v_payment.provider));

  return v_payment.id;
end;
$$;

revoke all on function public.declare_payment(uuid, text) from public;
grant execute on function public.declare_payment(uuid, text) to authenticated;

create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_provider_transaction_id text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
  v_allowed boolean;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;

  select public.is_admin() or exists (
    select 1 from public.order_items oi
    where oi.order_id = v_payment.order_id and oi.seller_id = auth.uid()
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Only a seller on this order or an administrator can confirm payment'
      using errcode = '42501';
  end if;
  if v_payment.status = 'successful' then
    return;
  end if;
  if v_payment.status in ('cancelled', 'refunded') then
    raise exception 'This payment is closed' using errcode = 'P0001';
  end if;

  perform set_config('shop_mumu.internal', 'on', true);
  update public.payments
     set status                  = 'successful',
         provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
         confirmed_by            = auth.uid(),
         confirmed_at            = now(),
         failure_reason          = null
   where id = p_payment_id;

  update public.orders set status = 'confirmed'
   where id = v_payment.order_id and status = 'pending';
  perform set_config('shop_mumu.internal', 'off', true);

  perform public.notify(
    v_order.user_id, 'payment.confirmed',
    'Payment confirmed for ' || v_order.reference,
    'Your payment has been verified by the seller.', '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.confirmed', 'payment', p_payment_id::text,
          jsonb_build_object('order', v_order.reference, 'amount_rwf', v_payment.amount_rwf));
end;
$$;

revoke all on function public.confirm_payment(uuid, text) from public;
grant execute on function public.confirm_payment(uuid, text) to authenticated;

create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
  v_allowed boolean;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reason is required when rejecting a payment' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;

  select public.is_admin() or exists (
    select 1 from public.order_items oi
    where oi.order_id = v_payment.order_id and oi.seller_id = auth.uid()
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Only a seller on this order or an administrator can reject a payment'
      using errcode = '42501';
  end if;
  if v_payment.status = 'successful' and not public.is_admin() then
    raise exception 'A confirmed payment can only be reversed by an administrator'
      using errcode = '42501';
  end if;

  perform set_config('shop_mumu.internal', 'on', true);
  update public.payments
     set status = 'failed', failure_reason = trim(p_reason)
   where id = p_payment_id;
  perform set_config('shop_mumu.internal', 'off', true);

  perform public.notify(
    v_order.user_id, 'payment.rejected',
    'Payment not verified for ' || v_order.reference,
    trim(p_reason), '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.rejected', 'payment', p_payment_id::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.reject_payment(uuid, text) from public;
grant execute on function public.reject_payment(uuid, text) to authenticated;

create or replace function public.record_refund(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can record a refund' using errcode = '42501';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_payment.status <> 'successful' then
    raise exception 'Only a confirmed payment can be refunded' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;

  perform set_config('shop_mumu.internal', 'on', true);
  update public.payments set status = 'refunded', failure_reason = trim(p_reason)
   where id = p_payment_id;
  update public.orders set status = 'refunded' where id = v_payment.order_id;
  perform set_config('shop_mumu.internal', 'off', true);

  perform public.notify(
    v_order.user_id, 'payment.refunded',
    'Refund recorded for ' || v_order.reference, trim(p_reason), '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.refunded', 'payment', p_payment_id::text,
          jsonb_build_object('reason', p_reason, 'amount_rwf', v_payment.amount_rwf));
end;
$$;

revoke all on function public.record_refund(uuid, text) from public;
grant execute on function public.record_refund(uuid, text) to authenticated;

create or replace function public.simulate_payment(p_payment_id uuid, p_succeed boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
begin
  if not public.sandbox_payments_enabled() then
    raise exception 'Sandbox payments are disabled on this environment' using errcode = '42501';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_payment.provider <> 'sandbox' then
    raise exception 'Only sandbox payments can be simulated' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;
  if v_order.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'This order is not yours' using errcode = '42501';
  end if;

  perform set_config('shop_mumu.internal', 'on', true);
  update public.payments
     set status = case when p_succeed then 'successful'::public.payment_status
                       else 'failed'::public.payment_status end,
         provider_transaction_id = 'SANDBOX-' || substr(md5(random()::text), 1, 12),
         confirmed_at   = case when p_succeed then now() else null end,
         failure_reason = case when p_succeed then null else 'Simulated failure (sandbox)' end
   where id = p_payment_id;

  if p_succeed then
    update public.orders set status = 'confirmed'
     where id = v_payment.order_id and status = 'pending';
  end if;
  perform set_config('shop_mumu.internal', 'off', true);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'payment.simulated', 'payment', p_payment_id::text,
          jsonb_build_object('succeeded', p_succeed, 'environment', 'sandbox'));
end;
$$;

revoke all on function public.simulate_payment(uuid, boolean) from public;
grant execute on function public.simulate_payment(uuid, boolean) to authenticated;

create or replace function public.confirm_payment_from_provider(
  p_transaction_reference text,
  p_provider_transaction_id text,
  p_amount_rwf bigint
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
begin
  select * into v_payment from public.payments
   where transaction_reference = p_transaction_reference;
  if v_payment.id is null then
    raise exception 'Unknown transaction reference' using errcode = 'P0002';
  end if;

  if v_payment.amount_rwf <> p_amount_rwf then
    raise exception 'Settled amount % does not match order amount %',
      p_amount_rwf, v_payment.amount_rwf using errcode = 'P0001';
  end if;
  if v_payment.status = 'successful' then
    return;
  end if;

  select * into v_order from public.orders where id = v_payment.order_id;

  update public.payments
     set status = 'successful',
         provider_transaction_id = p_provider_transaction_id,
         confirmed_at = now()
   where id = v_payment.id;

  update public.orders set status = 'confirmed'
   where id = v_payment.order_id and status = 'pending';

  perform public.notify(
    v_order.user_id, 'payment.confirmed',
    'Payment confirmed for ' || v_order.reference, null, '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'payment.provider_confirmed', 'payment', v_payment.id::text,
          jsonb_build_object('provider_transaction_id', p_provider_transaction_id));
end;
$$;

revoke all on function public.confirm_payment_from_provider(text, text, bigint) from public;
revoke all on function public.confirm_payment_from_provider(text, text, bigint) from anon, authenticated;

create or replace view public.seller_earnings
with (security_invoker = true) as
select
  c.seller_id,
  count(distinct c.order_id)                                     as paid_orders,
  coalesce(sum(c.gross_rwf), 0)::bigint                          as gross_rwf,
  coalesce(sum(c.commission_rwf), 0)::bigint                     as commission_rwf,
  coalesce(sum(c.seller_net_rwf), 0)::bigint                     as net_rwf
from public.commissions c
join public.payments p on p.order_id = c.order_id and p.status = 'successful'
group by c.seller_id;

grant select on public.seller_earnings to authenticated;
