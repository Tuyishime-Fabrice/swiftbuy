grant usage on schema public to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','sellers','categories','products','product_images',
    'cart_items','wishlist_items','orders','order_items','shipments',
    'payments','reviews','conversations','messages','notifications',
    'commissions','platform_settings','audit_logs','seller_documents','disputes'
  ] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

grant select on public.categories, public.products, public.product_images,
                public.sellers, public.reviews, public.platform_settings
  to anon, authenticated;

grant select on public.profiles, public.orders, public.order_items,
                public.shipments, public.payments, public.commissions,
                public.notifications, public.conversations, public.messages,
                public.audit_logs, public.seller_documents, public.disputes,
                public.cart_items, public.wishlist_items
  to authenticated;

grant insert, update, delete on public.products, public.product_images to authenticated;
grant insert, update, delete on public.cart_items, public.wishlist_items to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert, update on public.conversations to authenticated;
grant insert, update on public.messages to authenticated;
grant update, delete on public.notifications to authenticated;
grant update on public.profiles, public.sellers to authenticated;
grant update on public.platform_settings to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, delete on public.seller_documents to authenticated;

revoke insert, update, delete on
  public.orders, public.order_items, public.shipments, public.payments,
  public.commissions, public.audit_logs, public.disputes
  from anon, authenticated;
