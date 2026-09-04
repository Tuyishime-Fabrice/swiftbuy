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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seller-documents', 'seller-documents', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'shop_mumu:%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "shop_mumu: product images are public"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "shop_mumu: sellers upload their own product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller()
  );

create policy "shop_mumu: sellers replace their own product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shop_mumu: sellers delete their own product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "shop_mumu: profile images are public"
  on storage.objects for select
  using (bucket_id = 'profile-images');

create policy "shop_mumu: users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shop_mumu: seller documents are private"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "shop_mumu: sellers upload their own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'seller-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "shop_mumu: sellers delete their own documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'seller-documents'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create table if not exists public.seller_documents (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references public.sellers(id) on delete cascade,
  doc_type     text not null check (doc_type in ('business_licence', 'identity', 'other')),
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
