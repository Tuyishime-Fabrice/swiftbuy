-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy Rwanda — RLS FIX
--  Run this in Supabase → SQL Editor → New query → Run
--  This fixes the "Failed to approve" error when admins update sellers.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Drop the restrictive update policy ───────────────────────────────────────
drop policy if exists "Users: update own" on public.users;

-- ── New policies: users update themselves; admins update anyone ───────────────
create policy "Users: update own"
  on public.users for update
  using (auth.uid() = id);

create policy "Admins: update any user"
  on public.users for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

-- ── Also allow admins to read ALL users (not just public profiles) ────────────
drop policy if exists "Users: read all" on public.users;

create policy "Users: read all"
  on public.users for select
  using (true);

-- ── Allow admins to update product is_featured and is_active ─────────────────
drop policy if exists "Products: seller update" on public.products;

create policy "Products: seller update"
  on public.products for update
  using (
    auth.uid() = seller_id
    or exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

drop policy if exists "Products: seller delete" on public.products;

create policy "Products: seller delete"
  on public.products for delete
  using (
    auth.uid() = seller_id
    or exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'superadmin')
    )
  );

-- ── Allow admins to read ALL orders (sellers see only theirs via app logic) ───
drop policy if exists "Orders: user read" on public.orders;

create policy "Orders: user read"
  on public.orders for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'superadmin', 'seller')
    )
  );

-- ── Allow admins to update any order ─────────────────────────────────────────
drop policy if exists "Orders: user update" on public.orders;

create policy "Orders: user update"
  on public.orders for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.users
      where id = auth.uid()
      and role in ('admin', 'superadmin', 'seller')
    )
  );

-- ── Allow admins to push notifications to any user ────────────────────────────
drop policy if exists "Notifs: own" on public.notifications;

create policy "Notifs: own read"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Notifs: own delete"
  on public.notifications for delete
  using (auth.uid() = user_id);

create policy "Notifs: insert any"
  on public.notifications for insert
  with check (true);

create policy "Notifs: update own"
  on public.notifications for update
  using (auth.uid() = user_id);
