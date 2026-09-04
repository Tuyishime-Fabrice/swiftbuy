\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
set client_min_messages = notice;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.as_user(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $$;

create or replace function tests.ok(p_condition boolean, p_what text)
returns void language plpgsql as $$
begin
  if not p_condition then
    raise exception 'FAILED: %', p_what;
  end if;
  raise notice '  ok  %', p_what;
end $$;

create or replace function tests.denied(p_sql text, p_what text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice '  ok  % (refused: %)', p_what, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FAILED: % — the statement was allowed', p_what;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

truncate auth.users cascade;

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'amina@example.test',
   '{"full_name":"Amina Uwase","role":"customer"}'),
  ('22222222-2222-2222-2222-222222222222', 'bosco@example.test',
   '{"full_name":"Bosco Habimana","role":"customer"}'),
  ('33333333-3333-3333-3333-333333333333', 'gigi@example.test',
   '{"full_name":"Gigi Iwenga","role":"seller","store_name":"Gigi Electronics","momo_number":"+250780000001"}'),
  ('44444444-4444-4444-4444-444444444444', 'rival@example.test',
   '{"full_name":"Rival Seller","role":"seller","store_name":"Rival Store"}'),
  ('55555555-5555-5555-5555-555555555555', 'admin@example.test',
   '{"full_name":"Platform Admin","role":"customer"}'),
  ('66666666-6666-6666-6666-666666666666', 'root@example.test',
   '{"full_name":"Platform Root","role":"customer"}'),

  ('77777777-7777-7777-7777-777777777777', 'sneaky@example.test',
   '{"full_name":"Sneaky Person","role":"superadmin"}');

update public.profiles set role = 'admin'      where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'superadmin' where id = '66666666-6666-6666-6666-666666666666';

update public.platform_settings set commission_rate_bps = 700, delivery_fee_rwf = 2000;

\echo ''
\echo '── Signup and roles ──────────────────────────────────────────────────'

select tests.ok(
  (select role from public.profiles where id = '77777777-7777-7777-7777-777777777777') = 'customer',
  'signup metadata cannot grant an admin role');

select tests.ok(
  (select role from public.profiles where id = '33333333-3333-3333-3333-333333333333') = 'customer',
  'registering always creates a customer, whatever the metadata asks for');

select tests.ok(
  not exists (select 1 from public.sellers),
  'registering does not open a store — selling has to be applied for');

\echo ''
\echo '── Applying to sell ──────────────────────────────────────────────────'

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');

select tests.denied(
  $$select public.apply_to_sell('X')$$,
  'an application needs a real store name');

select tests.denied(
  $$select public.apply_to_sell('Gigi Electronics', null, 'not a phone')$$,
  'an application rejects an invalid Mobile Money number');

select public.apply_to_sell(
  'Gigi Electronics', 'Phones and accessories', '+250780000001', 'Gigi Iwenga',
  'Bank of Kigali', '1234567890');

select tests.ok(
  (select status from public.sellers where id = auth.uid()) = 'pending',
  'applying opens the store in pending, never approved');

select tests.ok(
  (select role from public.profiles where id = auth.uid()) = 'customer',
  'applying does not change the applicant''s role — they stay a customer');

select tests.denied(
  $$select public.apply_to_sell('Gigi Electronics Again')$$,
  'a second application cannot be opened while one is under review');

select tests.ok(
  exists (select 1 from public.notifications
          where user_id = auth.uid() and kind = 'seller.applied'),
  'the applicant is told their application was submitted');

reset role;
select tests.ok(
  exists (select 1 from public.notifications
          where user_id = '55555555-5555-5555-5555-555555555555'
            and kind = 'seller.application_received'),
  'administrators are notified that an application is waiting');

select tests.ok(
  exists (select 1 from public.audit_logs where action = 'seller.applied'),
  'the application is written to the audit log');
rollback;

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');
select public.apply_to_sell('Gigi Electronics', null, '+250780000001', 'Gigi Iwenga');
reset role;
select tests.as_user('44444444-4444-4444-4444-444444444444');
select public.apply_to_sell('Rival Store');
reset role;
commit;

\echo ''
\echo '── Verification documents ────────────────────────────────────────────'

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');
insert into public.seller_documents (seller_id, doc_type, storage_path, file_name)
values (auth.uid(), 'business_licence',
        '33333333-3333-3333-3333-333333333333/licence.pdf', 'licence.pdf');

select tests.ok(
  (select count(*) from public.seller_documents) = 1,
  'an applicant can attach a verification document to their application');

select tests.denied(
  $$insert into public.seller_documents (seller_id, doc_type, storage_path)
    values (auth.uid(), 'passport', 'x/y.pdf')$$,
  'a document must use one of the supported categories');

select tests.denied(
  $$insert into public.seller_documents (seller_id, doc_type, storage_path)
    values ('44444444-4444-4444-4444-444444444444', 'identity', 'x/y.pdf')$$,
  'an applicant cannot attach a document to somebody else''s application');
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.ok(
  (select count(*) from public.seller_documents) = 0,
  'an unrelated customer cannot read a seller''s verification documents');
select tests.ok(
  (select count(*) from public.seller_application_documents(
     '33333333-3333-3333-3333-333333333333')) = 0,
  'nor reach them through the review function');
reset role;

select tests.as_user('55555555-5555-5555-5555-555555555555');
select tests.ok(
  (select count(*) from public.seller_application_documents(
     '33333333-3333-3333-3333-333333333333')) = 1,
  'an administrator can see the documents before deciding');
reset role;
rollback;

begin;
\echo ''
\echo '── A customer cannot escalate their own privileges ────────────────────'

select tests.as_user('11111111-1111-1111-1111-111111111111');

update public.profiles set role = 'superadmin' where id = auth.uid();
select tests.ok(
  (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'customer',
  'a self-update cannot change your own role');

update public.profiles set full_name = 'Hijacked', role = 'admin'
 where id = '22222222-2222-2222-2222-222222222222';
select tests.ok(
  (select full_name = 'Bosco Habimana' and role = 'customer'
     from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'a customer cannot edit another user''s profile');

select tests.denied(
  $$select public.set_user_role('22222222-2222-2222-2222-222222222222', 'admin')$$,
  'set_user_role is refused to a customer');

reset role;
rollback;

begin;
\echo ''
\echo '── A seller cannot approve their own store ────────────────────────────'

select tests.as_user('33333333-3333-3333-3333-333333333333');

update public.sellers set status = 'approved' where id = auth.uid();
select tests.ok(
  (select status from public.sellers where id = '33333333-3333-3333-3333-333333333333') = 'pending',
  'a seller cannot set their own store to approved');

select tests.denied(
  $$select public.set_seller_status('33333333-3333-3333-3333-333333333333', 'approved')$$,
  'set_seller_status is refused to a seller');

select tests.denied(
  $$insert into public.products (seller_id, name, price_rwf, stock)
    values (auth.uid(), 'Premature Listing', 1000, 5)$$,
  'a pending seller cannot list products');

reset role;
rollback;

\echo ''
\echo '── Admin approves the stores (the supported path) ─────────────────────'

begin;
select tests.as_user('55555555-5555-5555-5555-555555555555');
select public.set_seller_status('33333333-3333-3333-3333-333333333333', 'approved');
select public.set_seller_status('44444444-4444-4444-4444-444444444444', 'approved');
reset role;
commit;

select tests.ok(
  (select status from public.sellers where id = '33333333-3333-3333-3333-333333333333') = 'approved',
  'an admin can approve a store');

select tests.ok(
  exists (select 1 from public.audit_logs where action = 'seller.status_changed'),
  'approving a seller writes an audit entry');

select tests.ok(
  exists (select 1 from public.notifications
          where user_id = '33333333-3333-3333-3333-333333333333'
            and kind = 'seller.status'),
  'approving a seller notifies them');

\echo ''
\echo '── Catalogue ownership ───────────────────────────────────────────────'

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');
insert into public.products (id, seller_id, category_id, name, description, price_rwf, stock)
values (
  'aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
  (select id from public.categories where slug = 'electronics'),
  'Samsung Galaxy S25', '128GB, sealed box', 980000, 3);

insert into public.products (id, seller_id, category_id, name, price_rwf, stock)
values (
  'aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
  (select id from public.categories where slug = 'sports'),
  'Yoga Mat', 22000, 30);
reset role;
commit;

select tests.ok(
  (select count(*) from public.products where seller_id = '33333333-3333-3333-3333-333333333333') = 2,
  'an approved seller can list products');

begin;
select tests.as_user('44444444-4444-4444-4444-444444444444');

update public.products set price_rwf = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok(
  (select price_rwf from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 980000,
  'one seller cannot reprice another seller''s product');

delete from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok(
  exists (select 1 from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'one seller cannot delete another seller''s product');

reset role;
rollback;

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');
update public.products set is_featured = true, rating_avg = 5, rating_count = 999
 where id = 'aaaaaaaa-0000-0000-0000-000000000002';
select tests.ok(
  (select not is_featured and rating_count = 0
     from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'a seller cannot feature their own product or forge its rating');
reset role;
rollback;

\echo ''
\echo '── Storefront visibility ─────────────────────────────────────────────'

begin;
select tests.as_anon();
select tests.ok(
  (select count(*) from public.products) = 2,
  'anonymous visitors see active products from approved stores');

select tests.denied(
  $$select count(*) from public.orders$$,
  'anonymous visitors cannot query orders at all');
reset role;
rollback;

begin;
select tests.as_user('55555555-5555-5555-5555-555555555555');
select public.set_seller_status('44444444-4444-4444-4444-444444444444', 'suspended', 'Test suspension');
reset role;
select tests.as_anon();
select tests.ok(
  not exists (
    select 1 from public.products p
    where p.seller_id = '44444444-4444-4444-4444-444444444444'),
  'a suspended store''s listings leave the storefront');
reset role;
rollback;

\echo ''
\echo '── The decision decides what a seller can do ─────────────────────────'

begin;
select tests.as_user('55555555-5555-5555-5555-555555555555');
select public.apply_to_sell('Admin Side Hustle');
select tests.denied(
  $$select public.set_seller_status('55555555-5555-5555-5555-555555555555', 'approved')$$,
  'an administrator cannot decide their own seller application');
reset role;
rollback;

begin;
select tests.as_user('33333333-3333-3333-3333-333333333333');
insert into public.seller_documents (seller_id, doc_type, storage_path, file_name)
values (auth.uid(), 'business_licence', '33333333-3333-3333-3333-333333333333/l.pdf', 'l.pdf');
reset role;

select tests.as_user('55555555-5555-5555-5555-555555555555');
select public.set_seller_status(
  '33333333-3333-3333-3333-333333333333', 'rejected', 'The document was not legible.');
reset role;

select tests.ok(
  (select reviewed_at is not null and reviewed_by = '55555555-5555-5555-5555-555555555555'
     from public.seller_documents
    where seller_id = '33333333-3333-3333-3333-333333333333' limit 1),
  'reaching a decision records that the documents were reviewed');

select tests.ok(
  (select status_reason from public.sellers where id = '33333333-3333-3333-3333-333333333333')
    = 'The document was not legible.',
  'the reason is stored so the applicant can read it');

select tests.ok(
  not exists (select 1 from public.products
              where seller_id = '33333333-3333-3333-3333-333333333333' and is_active),
  'a rejected store''s listings leave the storefront');

select tests.as_user('33333333-3333-3333-3333-333333333333');
select tests.denied(
  $$insert into public.products (seller_id, name, price_rwf, stock)
    values (auth.uid(), 'Listing After Rejection', 1000, 5)$$,
  'a rejected applicant cannot list products');

select public.apply_to_sell('Gigi Electronics', 'Clearer documents this time');
select tests.ok(
  (select status from public.sellers where id = auth.uid()) = 'pending',
  'a rejected applicant can correct their details and apply again');
select tests.ok(
  (select status_reason from public.sellers where id = auth.uid()) is null,
  're-applying clears the previous rejection reason');
reset role;
rollback;

\echo ''
\echo '── Applying to sell does not cost you your customer account ──────────'

begin;
select tests.as_user('22222222-2222-2222-2222-222222222222');
select public.apply_to_sell('Bosco Bikes');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);

create temp table pending_shop as
select * from public.place_order(
  'Bosco Habimana', '+250 780 000 002', 'Kigali', 'manual_momo', null);

select tests.ok(
  (select total_rwf from pending_shop) > 0,
  'an applicant keeps shopping normally while their store is under review');
reset role;
rollback;

begin;
select tests.as_user('44444444-4444-4444-4444-444444444444');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);

create temp table seller_shop as
select * from public.place_order(
  'Rival Seller', '+250 780 000 004', 'Kigali', 'manual_momo', null);

select tests.ok(
  (select total_rwf from seller_shop) > 0,
  'an approved seller can still buy from other stores as a customer');
reset role;
rollback;

\echo ''
\echo '── Cart privacy ──────────────────────────────────────────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 2);
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.ok(
  (select count(*) from public.cart_items) = 0,
  'one customer cannot see another customer''s cart');

select tests.denied(
  $$insert into public.cart_items (user_id, product_id, qty)
    values ('11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000001', 1)$$,
  'a customer cannot add items to someone else''s cart');
reset role;
rollback;

\echo ''
\echo '── Checkout: the server owns the money ───────────────────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');

select tests.denied(
  $$insert into public.orders
      (reference, user_id, subtotal_rwf, total_rwf,
       delivery_name, delivery_phone, delivery_address)
    values ('SB-FAKE', auth.uid(), 1, 1, 'Amina', '+250780000000', 'Kigali')$$,
  'a customer cannot insert an order directly');

insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 2),
       (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);

create temp table placed as
select * from public.place_order(
  'Amina Uwase', '+250 780 000 000', 'KK 243 St, Kigali', 'manual_momo', null);

select tests.ok(
  (select total_rwf from placed) = 1984000,
  'the order total is computed from server-side prices plus the configured fee');

select tests.ok(
  (select subtotal_rwf from public.orders where id = (select order_id from placed)) = 1982000,
  'the subtotal matches the catalogue prices, not anything the client sent');

select tests.ok(
  (select commission_rwf from public.orders where id = (select order_id from placed)) = 138740,
  'platform commission is calculated at the configured rate');

select tests.ok(
  (select sum(seller_net_rwf) from public.order_items
    where order_id = (select order_id from placed)) = 1982000 - 138740,
  'seller net equals gross minus commission');

select tests.ok(
  (select stock from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1,
  'stock is decremented by the ordered quantity');

select tests.ok(
  (select count(*) from public.cart_items where user_id = auth.uid()) = 0,
  'the cart is emptied once the order is placed');

select tests.ok(
  (select status from public.payments where order_id = (select order_id from placed)) = 'pending',
  'a new order opens a pending payment, never a successful one');

select tests.ok(
  (select count(*) from public.shipments where order_id = (select order_id from placed)) = 1,
  'one shipment is created per seller on the order');

reset role;
rollback;

\echo ''
\echo '── Checkout refuses to oversell ──────────────────────────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001', 99);

select tests.denied(
  $$select * from public.place_order(
      'Amina Uwase', '+250 780 000 000', 'KK 243 St, Kigali', 'manual_momo', null)$$,
  'ordering more than the available stock is refused');
reset role;
rollback;

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
select tests.denied(
  $$select * from public.place_order(
      'Amina Uwase', '+250 780 000 000', 'KK 243 St, Kigali', 'manual_momo', null)$$,
  'checking out an empty cart is refused');
reset role;
rollback;

\echo ''
\echo '── Multi-seller order splits into per-seller shipments ───────────────'

begin;
select tests.as_user('44444444-4444-4444-4444-444444444444');
insert into public.products (id, seller_id, name, price_rwf, stock)
values ('bbbbbbbb-0000-0000-0000-000000000001', auth.uid(), 'Rival Headphones', 45000, 10);
reset role;

select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty) values
  (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1),
  (auth.uid(), 'bbbbbbbb-0000-0000-0000-000000000001', 2);

create temp table multi as
select * from public.place_order(
  'Amina Uwase', '+250 780 000 000', 'KK 243 St, Kigali', 'cash_on_delivery', null);

select tests.ok(
  (select count(*) from public.shipments where order_id = (select order_id from multi)) = 2,
  'a two-seller basket produces two independent shipments');

select tests.ok(
  (select total_rwf from multi) = 22000 + 90000 + 2000,
  'the total spans both sellers plus one delivery fee');
reset role;
rollback;

\echo ''
\echo '── Payments: a buyer cannot settle their own order ───────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);

create temp table pay as
select * from public.place_order(
  'Amina Uwase', '+250 780 000 000', 'KK 243 St, Kigali', 'manual_momo', null);

select tests.denied(
  $$update public.payments set status = 'successful'
     where id = (select payment_id from pay)$$,
  'a buyer cannot write a payment row directly');

select tests.denied(
  $$select public.confirm_payment((select payment_id from pay))$$,
  'a buyer cannot confirm their own payment');

select public.declare_payment((select order_id from pay), 'MP240101.1234.A56789');
select tests.ok(
  (select status from public.payments where id = (select payment_id from pay))
    = 'awaiting_confirmation',
  'declaring a payment marks it awaiting confirmation, not paid');
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.denied(
  $$select public.confirm_payment((select payment_id from pay))$$,
  'an unrelated customer cannot confirm someone else''s payment');
reset role;

select tests.as_user('44444444-4444-4444-4444-444444444444');
select tests.denied(
  $$select public.confirm_payment((select payment_id from pay))$$,
  'a seller with no line on the order cannot confirm its payment');
reset role;

select tests.as_user('33333333-3333-3333-3333-333333333333');
select public.confirm_payment((select payment_id from pay), 'MP240101.1234.A56789');
select tests.ok(
  (select status from public.payments where id = (select payment_id from pay)) = 'successful',
  'the seller on the order can confirm the payment');
select tests.ok(
  (select status from public.orders where id = (select order_id from pay)) = 'confirmed',
  'confirming payment advances the order out of pending');
reset role;

select tests.as_user('11111111-1111-1111-1111-111111111111');
select tests.ok(
  (select count(*) from public.payments) = 1,
  'the buyer can read their own payment');
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.ok(
  (select count(*) from public.payments) = 0,
  'an unrelated customer cannot read that payment at all');
reset role;
rollback;

\echo ''
\echo '── Sandbox payments are refused unless explicitly enabled ────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);
select tests.denied(
  $$select * from public.place_order(
      'Amina Uwase', '+250 780 000 000', 'Kigali', 'sandbox', null)$$,
  'the sandbox payment simulator is off by default');
reset role;
rollback;

\echo ''
\echo '── Fulfilment transitions ────────────────────────────────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);
create temp table ship as
select * from public.place_order(
  'Amina Uwase', '+250 780 000 000', 'Kigali', 'manual_momo', null);
reset role;

select tests.as_user('44444444-4444-4444-4444-444444444444');
select tests.denied(
  $$select public.update_shipment_status(
      (select id from public.shipments where order_id = (select order_id from ship)), 'confirmed')$$,
  'a seller cannot advance another seller''s shipment');
reset role;

select tests.as_user('33333333-3333-3333-3333-333333333333');
select tests.denied(
  $$select public.update_shipment_status(
      (select id from public.shipments where order_id = (select order_id from ship)), 'delivered')$$,
  'a shipment cannot jump straight from pending to delivered');

select public.update_shipment_status(
  (select id from public.shipments where order_id = (select order_id from ship)), 'confirmed');
select public.update_shipment_status(
  (select id from public.shipments where order_id = (select order_id from ship)), 'preparing');
select public.update_shipment_status(
  (select id from public.shipments where order_id = (select order_id from ship)), 'ready_for_pickup');
select public.update_shipment_status(
  (select id from public.shipments where order_id = (select order_id from ship)), 'in_transit');

select tests.ok(
  (select status from public.orders where id = (select order_id from ship)) = 'shipped',
  'the order status is derived from its shipments');

select public.update_shipment_status(
  (select id from public.shipments where order_id = (select order_id from ship)), 'delivered');

select tests.ok(
  (select status from public.orders where id = (select order_id from ship)) = 'delivered',
  'an order reads delivered once every shipment is delivered');
reset role;

\echo ''
\echo '── Reviews require a delivered purchase ──────────────────────────────'

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.denied(
  $$insert into public.reviews (product_id, user_id, order_item_id, rating, comment)
    values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
            (select id from public.order_items where order_id = (select order_id from ship)),
            5, 'Never bought this')$$,
  'someone who did not buy the item cannot review it');
reset role;

select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.reviews (product_id, user_id, order_item_id, rating, comment)
values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
        (select id from public.order_items where order_id = (select order_id from ship)),
        4, 'Good mat, fast delivery.');

select tests.ok(
  (select rating_count from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 1
  and (select rating_avg from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000002') = 4,
  'a verified review updates the product rating cache');

select tests.denied(
  $$insert into public.reviews (product_id, user_id, order_item_id, rating, comment)
    values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
            (select id from public.order_items where order_id = (select order_id from ship)),
            1, 'Second review of the same purchase')$$,
  'the same purchased line cannot be reviewed twice');
reset role;
rollback;

\echo ''
\echo '── Order and message privacy ─────────────────────────────────────────'

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
insert into public.cart_items (user_id, product_id, qty)
values (auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000002', 1);
create temp table priv as
select * from public.place_order(
  'Amina Uwase', '+250 780 000 000', 'Kigali', 'manual_momo', null);
select tests.ok((select count(*) from public.orders) = 1, 'a customer sees their own order');
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.ok((select count(*) from public.orders) = 0,
  'one customer cannot see another customer''s orders');
reset role;

select tests.as_user('33333333-3333-3333-3333-333333333333');
select tests.ok((select count(*) from public.orders) = 1,
  'a seller sees an order that contains one of their lines');
reset role;

select tests.as_user('44444444-4444-4444-4444-444444444444');
select tests.ok((select count(*) from public.orders) = 0,
  'a seller with no line on the order cannot see it');
reset role;
rollback;

begin;
select tests.as_user('11111111-1111-1111-1111-111111111111');
create temp table conv as select public.get_or_create_conversation(
  '33333333-3333-3333-3333-333333333333') as id;
insert into public.messages (conversation_id, sender_id, body)
values ((select id from conv), auth.uid(), 'Hello, is the mat still available?');
select tests.ok((select count(*) from public.messages) = 1, 'a customer can message a seller');
reset role;

select tests.as_user('33333333-3333-3333-3333-333333333333');
select tests.ok((select count(*) from public.messages) = 1,
  'the seller sees messages addressed to them');

update public.messages set body = 'Rewritten', read_at = now()
 where id = (select id from public.messages limit 1);
select tests.ok(
  (select body = 'Hello, is the mat still available?' and read_at is not null
     from public.messages limit 1),
  'a recipient can mark a message read but cannot rewrite its text');
reset role;

select tests.as_user('22222222-2222-2222-2222-222222222222');
select tests.ok((select count(*) from public.messages) = 0,
  'a third party cannot read a conversation they are not in');
select tests.ok((select count(*) from public.conversations) = 0,
  'a third party cannot even see the conversation exists');
reset role;
rollback;

\echo ''
\echo '── Role administration ───────────────────────────────────────────────'

begin;
select tests.as_user('55555555-5555-5555-5555-555555555555');
select tests.denied(
  $$select public.set_user_role('11111111-1111-1111-1111-111111111111', 'admin')$$,
  'a plain admin cannot mint another admin');
reset role;

select tests.as_user('66666666-6666-6666-6666-666666666666');
select public.set_user_role('11111111-1111-1111-1111-111111111111', 'admin');
select tests.ok(
  (select role from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'admin',
  'a superadmin can grant the admin role');

select tests.denied(
  $$select public.set_user_role('66666666-6666-6666-6666-666666666666', 'customer')$$,
  'a superadmin cannot demote themselves');
reset role;
rollback;

\echo ''
\echo '── Commission arithmetic ─────────────────────────────────────────────'

select tests.ok(public.calc_commission(100000, 700) = 7000,
  '7% of 100,000 RWF is 7,000 RWF');
select tests.ok(public.calc_commission(0, 700) = 0,
  'commission on a zero-value line is zero');
select tests.ok(public.calc_commission(12345, 700) = 864,
  'commission rounds half-up to whole francs');
select tests.ok(public.calc_commission(100000, 0) = 0,
  'a zero commission rate takes nothing');
select tests.ok(public.calc_commission(100000, 10000) = 100000,
  'commission never exceeds the gross amount');

\echo ''
\echo '── Internal identifier naming ────────────────────────────────────────'

select tests.ok(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc like '%swiftbuy%') = 0,
  'no database function still refers to the former brand name');

select tests.ok(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'swiftbuy:%') = 0,
  'no storage policy still carries the former brand prefix');

select tests.ok(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc like '%shop_mumu.internal%') >= 10,
  'the guard setting is read and written under the current name');

select tests.ok(
  (select count(*) from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'shop_mumu:%') = 9,
  'all nine storage policies carry the current prefix');

begin;
select set_config('shop_mumu.internal', 'on', true);
select tests.ok(public.internal_context(),
  'the guard setting opens an internal context');
rollback;

select tests.ok(not public.internal_context(),
  'the guard setting is closed by default');

\echo ''
\echo '══ all security and commerce checks passed ══════════════════════════'
