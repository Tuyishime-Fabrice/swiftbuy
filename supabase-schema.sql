-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy Rwanda — Supabase Database Schema
--  Run this entire file in Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. USERS ────────────────────────────────────────────────────────────────
-- Extends Supabase's built-in auth.users table with profile data.
-- Every registered user gets a row here automatically (see trigger below).

create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  role          text not null default 'user'      -- 'user' | 'seller' | 'admin' | 'superadmin'
                check (role in ('user','seller','admin','superadmin')),
  phone         text,
  address       text,
  avatar_url    text,
  -- seller-specific
  approved      boolean default false,
  rejected      boolean default false,
  suspended     boolean default false,
  reject_reason text,
  -- seller payment info
  momo_number   text,
  momo_name     text,
  bank_name     text,
  bank_account  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Trigger: auto-create a users row when someone signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. PRODUCTS ─────────────────────────────────────────────────────────────
create table if not exists public.products (
  id          bigserial primary key,
  seller_id   uuid not null references public.users(id) on delete cascade,
  seller_name text not null,
  name        text not null,
  description text,
  category    text not null,
  price       numeric(12,2) not null check (price >= 0),
  stock       int not null default 0 check (stock >= 0),
  image_url   text,
  is_featured boolean default false,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists products_seller_id_idx on public.products(seller_id);
create index if not exists products_category_idx  on public.products(category);


-- ── 3. ORDERS ────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id              text primary key,          -- e.g. ORD-1716800000000-abc123
  user_id         uuid not null references public.users(id) on delete set null,
  user_name       text,
  user_address    text,
  items           jsonb not null default '[]',  -- [{productId, name, price, qty, sellerId, sellerName}]
  total           numeric(12,2) not null,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','rejected','cancelled')),
  payment_status  text not null default 'pending'
                  check (payment_status in ('pending','paid','refunded')),
  delivery_status text not null default 'not shipped'
                  check (delivery_status in ('not shipped','shipped','delivered')),
  delivery_info   jsonb,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);


-- ── 4. REVIEWS ───────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id          bigserial primary key,
  product_id  bigint not null references public.products(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  order_id    text references public.orders(id) on delete set null,
  user_name   text not null,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique (product_id, user_id, order_id)   -- one review per product per order
);

create index if not exists reviews_product_id_idx on public.reviews(product_id);


-- ── 5. CART ──────────────────────────────────────────────────────────────────
-- Persists cart server-side so it survives across devices.
create table if not exists public.cart_items (
  id          bigserial primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  product_id  bigint not null references public.products(id) on delete cascade,
  qty         int not null default 1 check (qty > 0),
  added_at    timestamptz default now(),
  unique (user_id, product_id)
);


-- ── 6. WISHLIST ──────────────────────────────────────────────────────────────
create table if not exists public.wishlist_items (
  id          bigserial primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  product_id  bigint not null references public.products(id) on delete cascade,
  added_at    timestamptz default now(),
  unique (user_id, product_id)
);


-- ── 7. NOTIFICATIONS ─────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  message     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);


-- ── 8. CHAT MESSAGES ─────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          bigserial primary key,
  sender_id   uuid not null references public.users(id) on delete cascade,
  receiver_id uuid not null references public.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz default now()
);

create index if not exists messages_pair_idx on public.messages(
  least(sender_id::text, receiver_id::text),
  greatest(sender_id::text, receiver_id::text)
);


-- ── 9. ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- Enable RLS on every table so users can only access what's theirs.

alter table public.users          enable row level security;
alter table public.products       enable row level security;
alter table public.orders         enable row level security;
alter table public.reviews        enable row level security;
alter table public.cart_items     enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.notifications  enable row level security;
alter table public.messages       enable row level security;

-- Users: everyone can read profiles; only you can update yours
create policy "Users: read all"     on public.users for select using (true);
create policy "Users: update own"   on public.users for update using (auth.uid() = id);

-- Products: anyone can read active products; sellers manage their own
create policy "Products: read active"   on public.products for select using (is_active = true);
create policy "Products: seller insert" on public.products for insert with check (auth.uid() = seller_id);
create policy "Products: seller update" on public.products for update using (auth.uid() = seller_id);
create policy "Products: seller delete" on public.products for delete using (auth.uid() = seller_id);

-- Orders: users see their own; sellers see orders containing their products
create policy "Orders: user read"   on public.orders for select using (auth.uid() = user_id);
create policy "Orders: user insert" on public.orders for insert with check (auth.uid() = user_id);
create policy "Orders: user update" on public.orders for update using (auth.uid() = user_id);

-- Reviews: readable by all; writable by authenticated users
create policy "Reviews: read all"   on public.reviews for select using (true);
create policy "Reviews: insert"     on public.reviews for insert with check (auth.uid() = user_id);

-- Cart & Wishlist: private to each user
create policy "Cart: own"      on public.cart_items     for all using (auth.uid() = user_id);
create policy "Wishlist: own"  on public.wishlist_items for all using (auth.uid() = user_id);

-- Notifications: private to each user
create policy "Notifs: own"    on public.notifications  for all using (auth.uid() = user_id);

-- Messages: sender or receiver can read; only sender can insert
create policy "Messages: read"   on public.messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "Messages: insert" on public.messages for insert with check (auth.uid() = sender_id);


-- ── 10. SEED: SUPERADMIN ─────────────────────────────────────────────────────
-- After running this schema, create the superadmin user via Supabase Auth
-- (Authentication → Users → Invite user) with email: superadmin@swiftbuy.rw
-- Then run this UPDATE to promote them:
--
--   update public.users set role = 'superadmin'
--   where email = 'superadmin@swiftbuy.rw';
--
-- The superadmin bypasses all seller approval checks and can manage admins.


-- ── 11. UPDATED_AT TRIGGER ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_users_updated_at    before update on public.users    for each row execute procedure public.set_updated_at();
create trigger set_products_updated_at before update on public.products for each row execute procedure public.set_updated_at();
create trigger set_orders_updated_at   before update on public.orders   for each row execute procedure public.set_updated_at();
