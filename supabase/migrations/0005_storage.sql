-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy V2 — 0005 Storage buckets and object policies
--
--  Product photos are files, not database columns. They live in Supabase
--  Storage; the database keeps only the object path (public.product_images).
--
--  Path convention — the first folder segment is always the owning user's id,
--  which is what the policies below key on:
--      product-images/<seller_id>/<product_id>/<uuid>.<ext>
--      profile-images/<user_id>/<uuid>.<ext>
--      seller-documents/<seller_id>/<uuid>.<ext>
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Buckets ─────────────────────────────────────────────────────────────────
-- Size and MIME allow-lists are enforced by Storage itself, so a hostile
-- client cannot upload a 40 MB executable by skipping the React form.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images', 'profile-images', true, 2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Verification documents are never public: only the seller who uploaded them
-- and platform admins can read them, and only via a signed URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-documents', 'seller-documents', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── Object policies ─────────────────────────────────────────────────────────

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'swiftbuy:%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Product images: world-readable (they are the storefront), writable only
-- inside the uploading seller's own folder.
create policy "swiftbuy: product images are public"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "swiftbuy: sellers upload their own product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller()
  );

create policy "swiftbuy: sellers replace their own product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "swiftbuy: sellers delete their own product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Avatars: public to read, private to write.
create policy "swiftbuy: profile images are public"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "swiftbuy: users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification documents: the owner and admins, nobody else.
create policy "swiftbuy: seller documents are private"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "swiftbuy: sellers upload their own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "swiftbuy: sellers delete their own documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ── Seller verification documents ───────────────────────────────────────────
-- Records what a seller submitted so an admin can review it before approving
-- the store. The file itself stays in the private bucket above.

create table if not exists public.seller_documents (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers(id) on delete cascade,
  doc_type     text not null check (doc_type in ('national_id', 'business_registration', 'tin_certificate', 'other')),
  storage_path text not null,
  file_name    text,
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists seller_documents_seller_idx on public.seller_documents(seller_id);

alter table public.seller_documents enable row level security;
alter table public.seller_documents force row level security;
select public.drop_policies('seller_documents');

create policy "seller_documents: owner read" on public.seller_documents
  for select using (auth.uid() = seller_id);

create policy "seller_documents: admin read" on public.seller_documents
  for select using (public.is_admin());

create policy "seller_documents: owner insert" on public.seller_documents
  for insert with check (auth.uid() = seller_id);

create policy "seller_documents: owner delete" on public.seller_documents
  for delete using (auth.uid() = seller_id or public.is_admin());
