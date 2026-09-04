create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

do $$ begin
  create type public.user_role as enum ('customer', 'seller', 'admin', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.seller_status as enum ('pending', 'approved', 'rejected', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'pending', 'confirmed', 'processing', 'ready_for_delivery',
    'shipped', 'delivered', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fulfilment_status as enum (
    'pending', 'confirmed', 'preparing', 'ready_for_pickup',
    'in_transit', 'delivered', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'pending', 'initiated', 'awaiting_confirmation',
    'successful', 'failed', 'cancelled', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum (
    'manual_momo', 'manual_bank', 'cash_on_delivery', 'sandbox'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) between 2 and 120),
  email       citext,
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  address     text check (address is null or length(address) <= 400),
  avatar_path text,
  role        public.user_role not null default 'customer',
  suspended   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

create table if not exists public.sellers (
  id             uuid primary key references public.profiles(id) on delete cascade,
  store_name     text not null check (length(trim(store_name)) between 2 and 120),
  store_slug     citext unique,
  description    text check (description is null or length(description) <= 2000),
  status         public.seller_status not null default 'pending',
  status_reason  text,

  momo_number    text check (momo_number is null or momo_number ~ '^\+?[0-9 ()-]{7,20}$'),
  momo_name      text,
  bank_name      text,
  bank_account   text,
  approved_at    timestamptz,
  approved_by    uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists sellers_status_idx on public.sellers(status);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       citext not null unique,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.sellers(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null check (length(trim(name)) between 2 and 160),
  slug          citext,
  description   text check (description is null or length(description) <= 5000),
  price_rwf     bigint not null check (price_rwf >= 0),
  stock         int not null default 0 check (stock >= 0),
  sku           text,
  is_featured   boolean not null default false,
  is_active     boolean not null default true,

  rating_avg    numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count  int not null default 0 check (rating_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists products_seller_idx    on public.products(seller_id);
create index if not exists products_category_idx  on public.products(category_id);
create index if not exists products_active_idx    on public.products(is_active, created_at desc);
create index if not exists products_price_idx     on public.products(price_rwf);

create extension if not exists pg_trgm;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text    text,
  position    int not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images(product_id, position);

create unique index if not exists product_images_one_primary_idx
  on public.product_images(product_id) where is_primary;

create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty        int not null default 1 check (qty > 0 and qty <= 999),
  added_at   timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists cart_items_user_idx on public.cart_items(user_id);

create table if not exists public.wishlist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  added_at   timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists wishlist_items_user_idx on public.wishlist_items(user_id);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  user_id           uuid not null references public.profiles(id) on delete restrict,
  status            public.order_status not null default 'pending',
  subtotal_rwf      bigint not null check (subtotal_rwf >= 0),
  delivery_fee_rwf  bigint not null default 0 check (delivery_fee_rwf >= 0),
  discount_rwf      bigint not null default 0 check (discount_rwf >= 0),
  total_rwf         bigint not null check (total_rwf >= 0),
  commission_rwf    bigint not null default 0 check (commission_rwf >= 0),
  delivery_name     text not null,
  delivery_phone    text not null,
  delivery_address  text not null,
  notes             text,
  placed_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_user_idx   on public.orders(user_id, placed_at desc);
create index if not exists orders_status_idx on public.orders(status);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  seller_id        uuid not null references public.sellers(id) on delete restrict,
  product_name     text not null,
  unit_price_rwf   bigint not null check (unit_price_rwf >= 0),
  qty              int not null check (qty > 0),
  line_total_rwf   bigint not null check (line_total_rwf >= 0),
  commission_rwf   bigint not null default 0 check (commission_rwf >= 0),
  seller_net_rwf   bigint not null default 0 check (seller_net_rwf >= 0),
  image_path       text,
  created_at       timestamptz not null default now()
);

create index if not exists order_items_order_idx  on public.order_items(order_id);
create index if not exists order_items_seller_idx on public.order_items(seller_id);

create table if not exists public.shipments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  seller_id         uuid not null references public.sellers(id) on delete restrict,
  status            public.fulfilment_status not null default 'pending',
  tracking_reference text,
  confirmed_at      timestamptz,
  in_transit_at     timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id, seller_id)
);

create index if not exists shipments_seller_idx on public.shipments(seller_id, status);

create table if not exists public.payments (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  provider                public.payment_provider not null,
  status                  public.payment_status not null default 'pending',
  amount_rwf              bigint not null check (amount_rwf >= 0),
  currency                text not null default 'RWF' check (currency = 'RWF'),
  transaction_reference   text not null unique,
  provider_transaction_id text,
  customer_reference      text,
  confirmed_by            uuid references public.profiles(id) on delete set null,
  confirmed_at            timestamptz,
  failure_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists payments_order_idx  on public.payments(order_id);
create index if not exists payments_status_idx on public.payments(status);

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  rating        int not null check (rating between 1 and 5),
  comment       text check (comment is null or length(comment) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_item_id)
);

create index if not exists reviews_product_idx on public.reviews(product_id, created_at desc);

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  seller_id       uuid not null references public.sellers(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (customer_id, seller_id)
);

create index if not exists conversations_customer_idx on public.conversations(customer_id, last_message_at desc);
create index if not exists conversations_seller_idx   on public.conversations(seller_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (length(trim(body)) between 1 and 4000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at desc);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where not is_read;

create table if not exists public.commissions (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  order_item_id   uuid not null references public.order_items(id) on delete cascade,
  seller_id       uuid not null references public.sellers(id) on delete restrict,
  gross_rwf       bigint not null check (gross_rwf >= 0),
  commission_rwf  bigint not null check (commission_rwf >= 0),
  seller_net_rwf  bigint not null check (seller_net_rwf >= 0),
  rate_bps        int not null check (rate_bps between 0 and 10000),
  created_at      timestamptz not null default now(),
  unique (order_item_id)
);

create index if not exists commissions_seller_idx on public.commissions(seller_id);

create table if not exists public.platform_settings (
  id                    boolean primary key default true check (id),
  commission_rate_bps   int not null default 0 check (commission_rate_bps between 0 and 10000),
  delivery_fee_rwf      bigint not null default 0 check (delivery_fee_rwf >= 0),
  free_delivery_over_rwf bigint check (free_delivery_over_rwf is null or free_delivery_over_rwf >= 0),
  low_stock_threshold   int not null default 5 check (low_stock_threshold >= 0),

  sandbox_payments_enabled boolean not null default false,
  updated_at            timestamptz not null default now()
);

insert into public.platform_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx  on public.audit_logs(entity_type, entity_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','sellers','products','orders','shipments','payments','reviews'
  ] loop
    execute format('drop trigger if exists set_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

insert into public.categories (name, slug, sort_order) values
  ('Electronics',   'electronics',   1),
  ('Clothing',      'clothing',      2),
  ('Food & Drinks', 'food-drinks',   3),
  ('Home & Living', 'home-living',   4),
  ('Beauty',        'beauty',        5),
  ('Sports',        'sports',        6),
  ('Other',         'other',         7)
on conflict (slug) do nothing;
