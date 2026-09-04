create or replace function public.notify(
  p_user_id uuid, p_kind text, p_title text,
  p_body text default null, p_link text default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user_id, p_kind, p_title, p_body, p_link);
end;
$$;

revoke all on function public.notify(uuid, text, text, text, text) from public;

create or replace function public.generate_order_reference()
returns text language sql volatile as $$
  select 'SB-' || to_char(now(), 'YYMMDD') || '-' ||
         upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6))
$$;

create or replace function public.calc_commission(p_gross bigint, p_rate_bps int)
returns bigint language sql immutable as $$
  select least(p_gross, greatest(0, ((p_gross * p_rate_bps) + 5000) / 10000))
$$;

create or replace function public.place_order(
  p_delivery_name    text,
  p_delivery_phone   text,
  p_delivery_address text,
  p_payment_provider public.payment_provider,
  p_notes            text default null
)
returns table (order_id uuid, reference text, total_rwf bigint, payment_id uuid)
language plpgsql security definer set search_path = public as $$

#variable_conflict use_column
declare
  v_user        uuid := auth.uid();
  v_settings    public.platform_settings%rowtype;
  v_order_id    uuid;
  v_reference   text;
  v_subtotal    bigint := 0;
  v_commission  bigint := 0;
  v_delivery    bigint := 0;
  v_total       bigint;
  v_payment_id  uuid;
  v_line        record;
  v_seller      uuid;
  v_count       int;
begin
  if v_user is null then
    raise exception 'You must be signed in to place an order' using errcode = '42501';
  end if;
  if coalesce(public.auth_suspended(), false) then
    raise exception 'This account is suspended' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_delivery_name, ''))) < 2 then
    raise exception 'A delivery name is required' using errcode = '22023';
  end if;
  if coalesce(p_delivery_phone, '') !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'A valid delivery phone number is required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_delivery_address, ''))) < 5 then
    raise exception 'A delivery address is required' using errcode = '22023';
  end if;

  if p_payment_provider = 'sandbox' and not public.sandbox_payments_enabled() then
    raise exception 'Sandbox payments are not enabled on this environment' using errcode = '42501';
  end if;

  select * into v_settings from public.platform_settings where id;

  perform 1
  from public.products p
  join public.cart_items ci on ci.product_id = p.id
  where ci.user_id = v_user
  order by p.id
  for update of p;

  select count(*) into v_count from public.cart_items where user_id = v_user;
  if v_count = 0 then
    raise exception 'Your cart is empty' using errcode = 'P0001';
  end if;

  for v_line in
    select ci.qty, p.id, p.name, p.stock, p.is_active, p.seller_id, s.status as seller_status
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    left join public.sellers s on s.id = p.seller_id
    where ci.user_id = v_user
    order by p.id
  loop
    if not v_line.is_active or v_line.seller_status is distinct from 'approved' then
      raise exception '% is no longer available', v_line.name using errcode = 'P0001';
    end if;
    if v_line.stock < v_line.qty then
      raise exception 'Only % of % left in stock', v_line.stock, v_line.name using errcode = 'P0001';
    end if;
  end loop;

  v_reference := public.generate_order_reference();

  insert into public.orders (
    reference, user_id, status, subtotal_rwf, delivery_fee_rwf,
    total_rwf, commission_rwf, delivery_name, delivery_phone, delivery_address, notes
  ) values (
    v_reference, v_user, 'pending', 0, 0, 0, 0,
    trim(p_delivery_name), trim(p_delivery_phone), trim(p_delivery_address),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_order_id;

  for v_line in
    select ci.qty, p.id as product_id, p.name, p.price_rwf, p.seller_id,
           (select pi.storage_path from public.product_images pi
             where pi.product_id = p.id
             order by pi.is_primary desc, pi.position asc limit 1) as image_path
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
    where ci.user_id = v_user
    order by p.id
  loop
    declare
      v_line_total bigint := v_line.price_rwf * v_line.qty;
      v_line_comm  bigint := public.calc_commission(v_line.price_rwf * v_line.qty,
                                                    v_settings.commission_rate_bps);
      v_item_id    uuid;
    begin
      insert into public.order_items (
        order_id, product_id, seller_id, product_name, unit_price_rwf,
        qty, line_total_rwf, commission_rwf, seller_net_rwf, image_path
      ) values (
        v_order_id, v_line.product_id, v_line.seller_id, v_line.name, v_line.price_rwf,
        v_line.qty, v_line_total, v_line_comm, v_line_total - v_line_comm, v_line.image_path
      )
      returning id into v_item_id;

      insert into public.commissions (
        order_id, order_item_id, seller_id, gross_rwf,
        commission_rwf, seller_net_rwf, rate_bps
      ) values (
        v_order_id, v_item_id, v_line.seller_id, v_line_total,
        v_line_comm, v_line_total - v_line_comm, v_settings.commission_rate_bps
      );

      perform set_config('shop_mumu.internal', 'on', true);
      update public.products
         set stock = stock - v_line.qty
       where id = v_line.product_id;
      perform set_config('shop_mumu.internal', 'off', true);

      v_subtotal   := v_subtotal + v_line_total;
      v_commission := v_commission + v_line_comm;
    end;
  end loop;

  insert into public.shipments (order_id, seller_id)
  select distinct v_order_id, seller_id from public.order_items where order_id = v_order_id;

  v_delivery := v_settings.delivery_fee_rwf;
  if v_settings.free_delivery_over_rwf is not null
     and v_subtotal >= v_settings.free_delivery_over_rwf then
    v_delivery := 0;
  end if;

  v_total := v_subtotal + v_delivery;

  update public.orders
     set subtotal_rwf     = v_subtotal,
         delivery_fee_rwf = v_delivery,
         total_rwf        = v_total,
         commission_rwf   = v_commission
   where id = v_order_id;

  insert into public.payments (
    order_id, provider, status, amount_rwf, transaction_reference
  ) values (
    v_order_id, p_payment_provider, 'pending', v_total,
    v_reference || '-P1'
  )
  returning id into v_payment_id;

  delete from public.cart_items where user_id = v_user;

  perform public.notify(
    v_user, 'order.placed', 'Order ' || v_reference || ' placed',
    'We have received your order. Follow its progress under My Orders.',
    '/orders');

  for v_seller in select distinct seller_id from public.order_items where order_id = v_order_id
  loop
    perform public.notify(
      v_seller, 'order.received', 'New order ' || v_reference,
      'A customer has ordered from your store.', '/seller');
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_user, 'order.placed', 'order', v_order_id::text,
          jsonb_build_object('reference', v_reference, 'total_rwf', v_total));

  return query select v_order_id, v_reference, v_total, v_payment_id;
end;
$$;

revoke all on function public.place_order(text, text, text, public.payment_provider, text) from public;
grant execute on function public.place_order(text, text, text, public.payment_provider, text) to authenticated;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_line  record;
  v_paid  boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.user_id <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot cancel this order' using errcode = '42501';
  end if;
  if v_order.status in ('cancelled', 'refunded', 'delivered') then
    raise exception 'This order can no longer be cancelled' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.payments
    where order_id = p_order_id and status = 'successful'
  ) into v_paid;

  if v_paid and not public.is_admin() then
    raise exception 'This order has been paid — please open a dispute instead'
      using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.shipments
    where order_id = p_order_id and status in ('in_transit', 'delivered')
  ) and not public.is_admin() then
    raise exception 'This order has already shipped' using errcode = 'P0001';
  end if;

  perform set_config('shop_mumu.internal', 'on', true);
  for v_line in
    select product_id, qty from public.order_items
    where order_id = p_order_id and product_id is not null
  loop
    update public.products set stock = stock + v_line.qty where id = v_line.product_id;
  end loop;

  update public.orders set status = 'cancelled' where id = p_order_id;
  update public.shipments set status = 'cancelled', cancelled_at = now()
   where order_id = p_order_id and status <> 'delivered';
  update public.payments set status = 'cancelled', failure_reason = coalesce(p_reason, 'Order cancelled')
   where order_id = p_order_id and status in ('pending', 'initiated', 'awaiting_confirmation');
  perform set_config('shop_mumu.internal', 'off', true);

  perform public.notify(
    v_order.user_id, 'order.cancelled', 'Order ' || v_order.reference || ' cancelled',
    coalesce(p_reason, 'Your order has been cancelled and any reserved stock released.'),
    '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'order.cancelled', 'order', p_order_id::text,
          jsonb_build_object('reason', p_reason));
end;
$$;

revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

create or replace function public.allowed_fulfilment_transition(
  p_from public.fulfilment_status, p_to public.fulfilment_status
)
returns boolean language sql immutable as $$
  select case p_from
    when 'pending'          then p_to in ('confirmed', 'cancelled')
    when 'confirmed'        then p_to in ('preparing', 'cancelled')
    when 'preparing'        then p_to in ('ready_for_pickup', 'cancelled')
    when 'ready_for_pickup' then p_to in ('in_transit', 'cancelled')
    when 'in_transit'       then p_to in ('delivered')
    else false
  end
$$;

create or replace function public.update_shipment_status(
  p_shipment_id uuid,
  p_status public.fulfilment_status,
  p_tracking_reference text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ship  public.shipments%rowtype;
  v_order public.orders%rowtype;
  v_label text;
begin
  select * into v_ship from public.shipments where id = p_shipment_id;
  if v_ship.id is null then
    raise exception 'Shipment not found' using errcode = 'P0002';
  end if;
  if v_ship.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'This shipment does not belong to you' using errcode = '42501';
  end if;
  if not public.allowed_fulfilment_transition(v_ship.status, p_status) then
    raise exception 'Cannot move a shipment from % to %', v_ship.status, p_status
      using errcode = 'P0001';
  end if;

  update public.shipments
     set status             = p_status,
         tracking_reference = coalesce(p_tracking_reference, tracking_reference),
         confirmed_at       = case when p_status = 'confirmed'   then now() else confirmed_at end,
         in_transit_at      = case when p_status = 'in_transit'  then now() else in_transit_at end,
         delivered_at       = case when p_status = 'delivered'   then now() else delivered_at end,
         cancelled_at       = case when p_status = 'cancelled'   then now() else cancelled_at end
   where id = p_shipment_id;

  select * into v_order from public.orders where id = v_ship.order_id;

  perform public.recalculate_order_status(v_ship.order_id);

  v_label := case p_status
    when 'confirmed'        then 'has been confirmed by the seller'
    when 'preparing'        then 'is being prepared'
    when 'ready_for_pickup' then 'is ready for pickup'
    when 'in_transit'       then 'is on its way'
    when 'delivered'        then 'has been delivered'
    when 'cancelled'        then 'was cancelled by the seller'
  end;

  perform public.notify(
    v_order.user_id, 'order.fulfilment',
    'Order ' || v_order.reference || ' ' || v_label,
    null, '/orders');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'shipment.status_changed', 'shipment', p_shipment_id::text,
          jsonb_build_object('from', v_ship.status, 'to', p_status));
end;
$$;

revoke all on function public.update_shipment_status(uuid, public.fulfilment_status, text) from public;
grant execute on function public.update_shipment_status(uuid, public.fulfilment_status, text) to authenticated;

create or replace function public.recalculate_order_status(p_order_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_delivered int;
  v_cancelled int;
  v_in_transit int;
  v_confirmed int;
  v_new public.order_status;
  v_current public.order_status;
begin
  select count(*),
         count(*) filter (where status = 'delivered'),
         count(*) filter (where status = 'cancelled'),
         count(*) filter (where status = 'in_transit'),
         count(*) filter (where status in ('confirmed','preparing','ready_for_pickup'))
    into v_total, v_delivered, v_cancelled, v_in_transit, v_confirmed
  from public.shipments where order_id = p_order_id;

  select status into v_current from public.orders where id = p_order_id;
  if v_current in ('cancelled', 'refunded') then
    return;
  end if;

  v_new := case
    when v_total = 0                         then v_current
    when v_cancelled = v_total               then 'cancelled'
    when v_delivered + v_cancelled = v_total then 'delivered'
    when v_in_transit > 0                    then 'shipped'
    when v_confirmed > 0                     then 'processing'
    else 'pending'
  end;

  if v_new is distinct from v_current then
    update public.orders set status = v_new where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.recalculate_order_status(uuid) from public;

create or replace function public.enforce_review_eligibility()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item      public.order_items%rowtype;
  v_order     public.orders%rowtype;
  v_delivered boolean;
begin
  select * into v_item from public.order_items where id = new.order_item_id;
  if v_item.id is null then
    raise exception 'That purchase does not exist' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_item.order_id;
  if v_order.user_id <> new.user_id then
    raise exception 'You can only review your own purchases' using errcode = '42501';
  end if;
  if v_item.product_id is distinct from new.product_id then
    raise exception 'Review does not match the purchased product' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.shipments
    where order_id = v_item.order_id
      and seller_id = v_item.seller_id
      and status = 'delivered'
  ) into v_delivered;

  if not v_delivered then
    raise exception 'You can review this product once the order has been delivered'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_eligibility_trg on public.reviews;
create trigger reviews_eligibility_trg
  before insert on public.reviews
  for each row execute function public.enforce_review_eligibility();

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  perform set_config('shop_mumu.internal', 'on', true);
  update public.products p
     set rating_avg = coalesce((
           select round(avg(r.rating)::numeric, 2) from public.reviews r
            where r.product_id = v_product), 0),
         rating_count = (
           select count(*) from public.reviews r where r.product_id = v_product)
   where p.id = v_product;
  perform set_config('shop_mumu.internal', 'off', true);
  return null;
end;
$$;

drop trigger if exists reviews_rating_trg on public.reviews;
create trigger reviews_rating_trg
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

create or replace function public.search_products(
  p_query       text default null,
  p_category    text default null,
  p_min_price   bigint default null,
  p_max_price   bigint default null,
  p_min_rating  numeric default null,
  p_seller_id   uuid default null,
  p_in_stock    boolean default false,
  p_sort        text default 'newest',
  p_limit       int default 24,
  p_offset      int default 0
)
returns table (
  id uuid, name text, description text, price_rwf bigint, stock int,
  is_featured boolean, rating_avg numeric, rating_count int,
  seller_id uuid, store_name text, category_name text,
  image_path text, created_at timestamptz, total_count bigint
)
language sql stable security definer set search_path = public as $$
  with matched as (
    select p.*, s.store_name, c.name as category_name
    from public.products p
    join public.sellers s   on s.id = p.seller_id and s.status = 'approved'
    left join public.categories c on c.id = p.category_id
    where p.is_active
      and (p_query is null or p_query = '' or
           p.name ilike '%' || p_query || '%' or p.description ilike '%' || p_query || '%')
      and (p_category is null or p_category = '' or c.name = p_category)
      and (p_min_price is null or p.price_rwf >= p_min_price)
      and (p_max_price is null or p.price_rwf <= p_max_price)
      and (p_min_rating is null or p.rating_avg >= p_min_rating)
      and (p_seller_id is null or p.seller_id = p_seller_id)
      and (not p_in_stock or p.stock > 0)
  )
  select m.id, m.name, m.description, m.price_rwf, m.stock,
         m.is_featured, m.rating_avg, m.rating_count,
         m.seller_id, m.store_name, m.category_name,
         (select pi.storage_path from public.product_images pi
           where pi.product_id = m.id
           order by pi.is_primary desc, pi.position asc limit 1),
         m.created_at,
         count(*) over () as total_count
  from matched m
  order by
    case when p_sort = 'featured'   then (not m.is_featured)::int end asc,
    case when p_sort = 'price_asc'  then m.price_rwf end asc,
    case when p_sort = 'price_desc' then m.price_rwf end desc,
    case when p_sort = 'rating'     then m.rating_avg end desc,
    m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.search_products(
  text, text, bigint, bigint, numeric, uuid, boolean, text, int, int
) to anon, authenticated;

create or replace function public.get_or_create_conversation(p_seller_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to send a message' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sellers where id = p_seller_id and status = 'approved') then
    raise exception 'This store is not available' using errcode = 'P0002';
  end if;

  select id into v_id from public.conversations
   where customer_id = auth.uid() and seller_id = p_seller_id;

  if v_id is null then
    insert into public.conversations (customer_id, seller_id)
    values (auth.uid(), p_seller_id)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.get_or_create_conversation(uuid) from public;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

create or replace function public.on_message_sent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_conv public.conversations%rowtype;
  v_recipient uuid;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

  v_recipient := case when new.sender_id = v_conv.customer_id
                      then v_conv.seller_id else v_conv.customer_id end;

  perform public.notify(v_recipient, 'message.new', 'New message',
                        left(new.body, 120),
                        case when v_recipient = v_conv.seller_id
                             then '/seller/chats' else '/messages' end);
  return null;
end;
$$;

drop trigger if exists messages_after_insert_trg on public.messages;
create trigger messages_after_insert_trg
  after insert on public.messages
  for each row execute function public.on_message_sent();
