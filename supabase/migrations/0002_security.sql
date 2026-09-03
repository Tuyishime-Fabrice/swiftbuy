-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy V2 — 0002 Authorization, RLS and signup
--
--  Every table is protected by Row Level Security. The browser holds only an
--  anon key and a user JWT, so these policies — not the React code — are what
--  actually decide who may read or write a row.
--
--  Two things this migration is careful about:
--   1. Role lookups inside a policy on `profiles` would recurse. All helpers
--      are `security definer` and marked `set search_path`, so they read the
--      table without re-entering RLS.
--   2. `update` policies always carry a `with check` clause. A `using`-only
--      policy lets a user rewrite the row into something they could not have
--      created — that is how a customer would promote themselves to admin.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Role helpers ────────────────────────────────────────────────────────────

-- Named auth_role rather than current_role: CURRENT_ROLE is a reserved
-- keyword in Postgres and would collide inside policy expressions.
create or replace function public.auth_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_suspended()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.auth_seller_status()
returns public.seller_status
language sql stable security definer set search_path = public as $$
  select status from public.sellers where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin','superadmin') from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'superadmin' from public.profiles where id = auth.uid()),
    false)
$$;

-- True only for a seller whose store has actually been approved. Pending,
-- rejected and suspended sellers hold the role but get no seller privileges.
create or replace function public.is_approved_seller()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status = 'approved' from public.sellers where id = auth.uid()),
    false)
$$;

-- Whether the development payment simulator is enabled for this project.
create or replace function public.sandbox_payments_enabled()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sandbox_payments_enabled from public.platform_settings where id), false)
$$;

-- Order membership helpers.
--
-- These must be SECURITY DEFINER: `orders` and `order_items` each need to ask
-- about the other, and expressing that as a plain sub-select inside a policy
-- makes the two policies recurse into each other. Reading through a definer
-- function breaks the cycle.
create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders where id = p_order_id and user_id = auth.uid()
  )
$$;

create or replace function public.sells_on_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items
    where order_id = p_order_id and seller_id = auth.uid()
  )
$$;

create or replace function public.owns_product(p_product_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.products
    where id = p_product_id and seller_id = auth.uid()
  )
$$;

-- ── Signup: create the profile row ──────────────────────────────────────────
-- The role is taken from signup metadata but clamped to the two roles a
-- stranger is allowed to self-assign. 'admin'/'superadmin' can never be
-- obtained by passing metadata at signup — an existing superadmin must grant
-- them (see public.set_user_role below).

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_requested text := coalesce(new.raw_user_meta_data->>'role', 'customer');
  v_role public.user_role;
  v_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1));
begin
  v_role := case when v_requested = 'seller' then 'seller'::public.user_role
                 else 'customer'::public.user_role end;

  insert into public.profiles (id, full_name, email, role)
  values (new.id, v_name, new.email, v_role)
  on conflict (id) do nothing;

  -- A seller signup also opens a store record in 'pending'. Approval is an
  -- admin action; nothing the signing-up user sends can skip it.
  if v_role = 'seller' then
    insert into public.sellers (id, store_name, store_slug, momo_number, momo_name, bank_name, bank_account)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'store_name'), ''), v_name),
      null,
      nullif(trim(new.raw_user_meta_data->>'momo_number'), ''),
      nullif(trim(new.raw_user_meta_data->>'momo_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'bank_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'bank_account'), '')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Enable RLS everywhere ───────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','sellers','categories','products','product_images',
    'cart_items','wishlist_items','orders','order_items','shipments',
    'payments','reviews','conversations','messages','notifications',
    'commissions','platform_settings','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Helper so this migration can be re-run cleanly.
create or replace function public.drop_policies(p_table text)
returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname = 'public' and tablename = p_table
  loop
    execute format('drop policy %I on public.%I', r.policyname, p_table);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','sellers','categories','products','product_images',
    'cart_items','wishlist_items','orders','order_items','shipments',
    'payments','reviews','conversations','messages','notifications',
    'commissions','platform_settings','audit_logs'
  ] loop
    perform public.drop_policies(t);
  end loop;
end $$;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Anyone signed in can read basic profiles (needed to render seller names and
-- chat participants). Writing is limited to your own row, and the `with check`
-- clause pins role and suspension so a self-update cannot escalate.

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: read others authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles: admin read" on public.profiles
  for select using (public.is_admin());

create policy "profiles: update own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = public.auth_role()
    and suspended = public.auth_suspended()
  );

create policy "profiles: admin update" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ── sellers ─────────────────────────────────────────────────────────────────
-- Approved stores are public. A seller sees their own record in any state so
-- they can read a rejection reason; only admins change status.

create policy "sellers: read approved" on public.sellers
  for select using (status = 'approved');

create policy "sellers: read own" on public.sellers
  for select using (auth.uid() = id);

create policy "sellers: admin read" on public.sellers
  for select using (public.is_admin());

create policy "sellers: update own profile" on public.sellers
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and status = public.auth_seller_status());

create policy "sellers: admin update" on public.sellers
  for update using (public.is_admin()) with check (public.is_admin());

-- ── categories ──────────────────────────────────────────────────────────────
create policy "categories: public read" on public.categories
  for select using (is_active or public.is_admin());

create policy "categories: admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

-- ── products ────────────────────────────────────────────────────────────────
-- The storefront reads only active products belonging to approved stores.
-- Sellers manage their own catalogue; nothing lets one seller touch another's.

create policy "products: public read active" on public.products
  for select using (
    is_active and exists (
      select 1 from public.sellers s
      where s.id = products.seller_id and s.status = 'approved')
  );

create policy "products: seller read own" on public.products
  for select using (auth.uid() = seller_id);

create policy "products: admin read" on public.products
  for select using (public.is_admin());

create policy "products: seller insert own" on public.products
  for insert with check (auth.uid() = seller_id and public.is_approved_seller());

-- Platform-controlled columns (rating cache, featured flag, owner) are pinned
-- by the products_guard trigger below rather than by a self-referencing
-- WITH CHECK, which keeps the policy readable and the rule in one place.
create policy "products: seller update own" on public.products
  for update
  using (auth.uid() = seller_id and public.is_approved_seller())
  with check (auth.uid() = seller_id);

create policy "products: seller delete own" on public.products
  for delete using (auth.uid() = seller_id);

create policy "products: admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ── product_images ──────────────────────────────────────────────────────────
create policy "product_images: public read" on public.product_images
  for select using (
    exists (
      select 1 from public.products p join public.sellers s on s.id = p.seller_id
      where p.id = product_images.product_id and p.is_active and s.status = 'approved')
    or public.owns_product(product_id)
    or public.is_admin()
  );

create policy "product_images: seller write" on public.product_images
  for all using (public.owns_product(product_id)) with check (public.owns_product(product_id));

create policy "product_images: admin write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

-- ── cart & wishlist ─────────────────────────────────────────────────────────
-- Strictly private. Not even an admin reads someone's cart.

create policy "cart: own rows" on public.cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wishlist: own rows" on public.wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── orders ──────────────────────────────────────────────────────────────────
-- Customers see their own orders. A seller sees an order only if it contains
-- one of their lines — that is a membership test, not a blanket seller grant.
--
-- There is deliberately NO insert policy: orders are created exclusively by
-- public.place_order() (0003_commerce.sql), which computes the money itself.
-- And no customer update policy: cancelling goes through public.cancel_order().

create policy "orders: customer read own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders: seller read own lines" on public.orders
  for select using (public.sells_on_order(id));

create policy "orders: admin read" on public.orders
  for select using (public.is_admin());

create policy "orders: admin update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ── order_items ─────────────────────────────────────────────────────────────
create policy "order_items: customer read own" on public.order_items
  for select using (public.owns_order(order_id));

create policy "order_items: seller read own" on public.order_items
  for select using (auth.uid() = seller_id);

create policy "order_items: admin read" on public.order_items
  for select using (public.is_admin());

-- ── shipments ───────────────────────────────────────────────────────────────
-- Sellers advance their own fulfilment; status transitions are validated in
-- public.update_shipment_status(), which is the only supported write path.

create policy "shipments: customer read" on public.shipments
  for select using (public.owns_order(order_id));

create policy "shipments: seller read own" on public.shipments
  for select using (auth.uid() = seller_id);

create policy "shipments: admin read" on public.shipments
  for select using (public.is_admin());

-- ── payments ────────────────────────────────────────────────────────────────
-- Readable by the buyer, the sellers on the order, and admins. No client may
-- INSERT or UPDATE a payment: both go through security-definer functions in
-- 0004_payments.sql. This is what stops "click button → order is paid".

create policy "payments: customer read own" on public.payments
  for select using (public.owns_order(order_id));

create policy "payments: seller read own orders" on public.payments
  for select using (public.sells_on_order(order_id));

create policy "payments: admin read" on public.payments
  for select using (public.is_admin());

-- ── reviews ─────────────────────────────────────────────────────────────────
-- Public to read. Insert is additionally gated by the verified-purchase
-- trigger in 0003_commerce.sql; the policy alone is not the whole rule.

create policy "reviews: public read" on public.reviews
  for select using (true);

create policy "reviews: author insert" on public.reviews
  for insert with check (auth.uid() = user_id);

create policy "reviews: author update" on public.reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "reviews: author delete" on public.reviews
  for delete using (auth.uid() = user_id or public.is_admin());

-- ── conversations & messages ────────────────────────────────────────────────
-- Membership is the whole access rule. A user who is neither the customer nor
-- the seller on a conversation cannot see that it exists.

create policy "conversations: participant read" on public.conversations
  for select using (auth.uid() = customer_id or auth.uid() = seller_id);

create policy "conversations: customer create" on public.conversations
  for insert with check (
    auth.uid() = customer_id
    and exists (select 1 from public.sellers s
                where s.id = conversations.seller_id and s.status = 'approved')
  );

create policy "conversations: participant update" on public.conversations
  for update
  using (auth.uid() = customer_id or auth.uid() = seller_id)
  with check (auth.uid() = customer_id or auth.uid() = seller_id);

create policy "messages: participant read" on public.messages
  for select using (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and (c.customer_id = auth.uid() or c.seller_id = auth.uid()))
  );

create policy "messages: participant send" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.conversations c
                where c.id = messages.conversation_id
                  and (c.customer_id = auth.uid() or c.seller_id = auth.uid()))
  );

-- Marking a message read is the only permitted update, and only by the
-- recipient — you cannot edit what you or anybody else already sent.
-- Only the recipient may update, and messages_guard (below) pins body,
-- sender and timestamp so "mark as read" is genuinely the only effect.
create policy "messages: recipient marks read" on public.messages
  for update
  using (
    sender_id <> auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = messages.conversation_id
                  and (c.customer_id = auth.uid() or c.seller_id = auth.uid()))
  )
  with check (sender_id <> auth.uid());

-- ── notifications ───────────────────────────────────────────────────────────
-- Read and mark-read are yours alone. Notifications are *created* by
-- security-definer functions, so no client can spam another user's feed.

create policy "notifications: own read" on public.notifications
  for select using (auth.uid() = user_id);

create policy "notifications: own mark read" on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications: own delete" on public.notifications
  for delete using (auth.uid() = user_id);

-- ── commissions ─────────────────────────────────────────────────────────────
-- A seller sees their own earnings and nothing about anyone else's.

create policy "commissions: seller read own" on public.commissions
  for select using (auth.uid() = seller_id);

create policy "commissions: admin read" on public.commissions
  for select using (public.is_admin());

-- ── platform_settings ───────────────────────────────────────────────────────
-- Readable by everyone (the storefront needs the delivery fee to show a
-- truthful total); writable by superadmin only.

create policy "settings: public read" on public.platform_settings
  for select using (true);

create policy "settings: superadmin write" on public.platform_settings
  for update using (public.is_superadmin()) with check (public.is_superadmin());

-- ── audit_logs ──────────────────────────────────────────────────────────────
-- Append-only from the application's perspective: written by security-definer
-- functions, readable by admins, updatable and deletable by no one.

create policy "audit: admin read" on public.audit_logs
  for select using (public.is_admin());

-- ── Role administration ─────────────────────────────────────────────────────
-- The only supported way to change a role. Restricted to superadmins, refuses
-- to touch another superadmin, and writes an audit entry.

create or replace function public.set_user_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = public as $$
declare v_current public.user_role;
begin
  if not public.is_superadmin() then
    raise exception 'Only a superadmin may change roles' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;

  select role into v_current from public.profiles where id = p_user_id;
  if v_current is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;
  if v_current = 'superadmin' then
    raise exception 'Another superadmin''s role cannot be changed here' using errcode = '42501';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'role.changed', 'profile', p_user_id::text,
          jsonb_build_object('from', v_current, 'to', p_role));
end;
$$;

revoke all on function public.set_user_role(uuid, public.user_role) from public;
grant execute on function public.set_user_role(uuid, public.user_role) to authenticated;

-- ── Seller moderation ───────────────────────────────────────────────────────
create or replace function public.set_seller_status(
  p_seller_id uuid,
  p_status public.seller_status,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_previous public.seller_status;
begin
  if not public.is_admin() then
    raise exception 'Only an admin may moderate sellers' using errcode = '42501';
  end if;

  select status into v_previous from public.sellers where id = p_seller_id;
  if v_previous is null then
    raise exception 'Seller not found' using errcode = 'P0002';
  end if;

  update public.sellers
     set status        = p_status,
         status_reason = p_reason,
         approved_at   = case when p_status = 'approved' then now() else approved_at end,
         approved_by   = case when p_status = 'approved' then auth.uid() else approved_by end
   where id = p_seller_id;

  -- A suspended or rejected store's listings leave the storefront immediately.
  if p_status in ('suspended', 'rejected') then
    update public.products set is_active = false where seller_id = p_seller_id;
  end if;

  insert into public.notifications (user_id, kind, title, body, link)
  values (
    p_seller_id, 'seller.status',
    case p_status
      when 'approved'  then 'Your store has been approved'
      when 'rejected'  then 'Your seller application was rejected'
      when 'suspended' then 'Your store has been suspended'
      else 'Your store status changed' end,
    coalesce(p_reason, case p_status
      when 'approved' then 'You can now list products on SwiftBuy.'
      else null end),
    '/seller');

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'seller.status_changed', 'seller', p_seller_id::text,
          jsonb_build_object('from', v_previous, 'to', p_status, 'reason', p_reason));
end;
$$;

revoke all on function public.set_seller_status(uuid, public.seller_status, text) from public;
grant execute on function public.set_seller_status(uuid, public.seller_status, text) to authenticated;

-- ── Account suspension ──────────────────────────────────────────────────────
create or replace function public.set_user_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may suspend accounts' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend your own account' using errcode = '42501';
  end if;
  if (select role from public.profiles where id = p_user_id) = 'superadmin' then
    raise exception 'A superadmin account cannot be suspended here' using errcode = '42501';
  end if;

  update public.profiles set suspended = p_suspended where id = p_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(),
          case when p_suspended then 'user.suspended' else 'user.unsuspended' end,
          'profile', p_user_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.set_user_suspended(uuid, boolean) from public;
grant execute on function public.set_user_suspended(uuid, boolean) to authenticated;

-- ── Featured products (platform merchandising, admin only) ──────────────────
create or replace function public.set_product_featured(p_product_id uuid, p_featured boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin may feature products' using errcode = '42501';
  end if;
  update public.products set is_featured = p_featured where id = p_product_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'product.featured_changed', 'product', p_product_id::text,
          jsonb_build_object('featured', p_featured));
end;
$$;

revoke all on function public.set_product_featured(uuid, boolean) from public;
grant execute on function public.set_product_featured(uuid, boolean) to authenticated;

-- ── Column guards ───────────────────────────────────────────────────────────
-- Some columns must not move even when the row itself is writable by the
-- caller. Enforcing that here rather than in a self-referencing WITH CHECK
-- keeps each rule in one place and lets trusted server-side functions opt out
-- explicitly via the transaction-local `swiftbuy.internal` flag.

create or replace function public.internal_context()
returns boolean
language sql stable as $$
  select coalesce(current_setting('swiftbuy.internal', true), '') = 'on'
$$;

-- True when the statement is NOT coming from a browser session. PostgREST
-- executes browser requests as `anon` or `authenticated`; the SQL editor, a
-- migration, and service-role calls run as something else. Operators with
-- direct database access are already trusted, and the guards below would
-- otherwise leave no way to bootstrap the very first superadmin.
create or replace function public.is_privileged_connection()
returns boolean
language sql stable as $$
  select current_user not in ('anon', 'authenticated')
$$;

-- These guards run as SECURITY INVOKER on purpose: they must observe the real
-- caller's role, which is what public.is_privileged_connection() reads. A
-- definer function would always report its owner and never see a browser.
create or replace function public.products_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.internal_context() or public.is_admin() or public.is_privileged_connection() then
    return new;
  end if;
  -- A seller may edit their listing but not its ownership, its rating cache,
  -- or whether the platform features it.
  new.seller_id    := old.seller_id;
  new.rating_avg   := old.rating_avg;
  new.rating_count := old.rating_count;
  new.is_featured  := old.is_featured;
  return new;
end;
$$;

drop trigger if exists products_guard_trg on public.products;
create trigger products_guard_trg
  before update on public.products
  for each row execute function public.products_guard();


create or replace function public.messages_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- The only field an update may change is read_at.
  new.body            := old.body;
  new.sender_id       := old.sender_id;
  new.conversation_id := old.conversation_id;
  new.created_at      := old.created_at;
  return new;
end;
$$;

drop trigger if exists messages_guard_trg on public.messages;
create trigger messages_guard_trg
  before update on public.messages
  for each row execute function public.messages_guard();


create or replace function public.reviews_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Editing a review may change the rating and comment, never what it is
  -- attached to or who wrote it.
  new.product_id    := old.product_id;
  new.user_id       := old.user_id;
  new.order_item_id := old.order_item_id;
  return new;
end;
$$;

drop trigger if exists reviews_guard_trg on public.reviews;
create trigger reviews_guard_trg
  before update on public.reviews
  for each row execute function public.reviews_guard();


create or replace function public.notifications_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.internal_context() or public.is_privileged_connection() then
    return new;
  end if;
  -- Recipients may only flip is_read; they cannot rewrite the message.
  new.user_id := old.user_id;
  new.kind    := old.kind;
  new.title   := old.title;
  new.body    := old.body;
  new.link    := old.link;
  return new;
end;
$$;

drop trigger if exists notifications_guard_trg on public.notifications;
create trigger notifications_guard_trg
  before update on public.notifications
  for each row execute function public.notifications_guard();


create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.internal_context() or public.is_admin() or public.is_privileged_connection() then
    return new;
  end if;
  -- Belt and braces alongside the RLS WITH CHECK: role and suspension are
  -- never self-service, and the auth email stays authoritative.
  new.role      := old.role;
  new.suspended := old.suspended;
  new.email     := old.email;
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();


create or replace function public.sellers_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.internal_context() or public.is_admin() or public.is_privileged_connection() then
    return new;
  end if;
  -- A seller edits their storefront copy; approval state belongs to admins.
  new.status        := old.status;
  new.status_reason := old.status_reason;
  new.approved_at   := old.approved_at;
  new.approved_by   := old.approved_by;
  return new;
end;
$$;

drop trigger if exists sellers_guard_trg on public.sellers;
create trigger sellers_guard_trg
  before update on public.sellers
  for each row execute function public.sellers_guard();
