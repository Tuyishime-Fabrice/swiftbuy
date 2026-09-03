-- ═══════════════════════════════════════════════════════════════════════════
--  SwiftBuy V2 — 0007 Table privileges
--
--  RLS decides *which rows* a caller may touch; SQL privileges decide whether
--  they may attempt the verb at all. A Supabase project grants broadly to
--  anon/authenticated by default, so this file states the intended grants
--  explicitly rather than inheriting whatever the project template happens to
--  have — and revokes the verbs that must only ever happen through a
--  security-definer function.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

-- Start from a known state.
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

-- ── Public storefront reads (no session required) ───────────────────────────
grant select on public.categories, public.products, public.product_images,
                public.sellers, public.reviews, public.platform_settings
  to anon, authenticated;

-- ── Signed-in reads ─────────────────────────────────────────────────────────
grant select on public.profiles, public.orders, public.order_items,
                public.shipments, public.payments, public.commissions,
                public.notifications, public.conversations, public.messages,
                public.audit_logs, public.seller_documents, public.disputes,
                public.cart_items, public.wishlist_items
  to authenticated;

-- ── Direct writes, still narrowed by RLS ────────────────────────────────────
-- Sellers manage their catalogue; everyone manages their own cart, wishlist,
-- profile, conversations and reviews.
grant insert, update, delete on public.products, public.product_images to authenticated;
grant insert, update, delete on public.cart_items, public.wishlist_items to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant insert, update on public.conversations to authenticated;
grant insert, update on public.messages to authenticated;
grant update, delete on public.notifications to authenticated;
grant update on public.profiles, public.sellers to authenticated;
grant update on public.platform_settings to authenticated;   -- narrowed to superadmin by RLS
grant insert, update, delete on public.categories to authenticated;  -- narrowed to admin by RLS
grant insert, delete on public.seller_documents to authenticated;

-- ── Never writable from a browser ───────────────────────────────────────────
-- Orders, order lines, shipments, payments, commissions, disputes and the
-- audit trail change only through the security-definer functions, which is
-- what keeps prices, stock and payment state out of the client's hands.
revoke insert, update, delete on
  public.orders, public.order_items, public.shipments, public.payments,
  public.commissions, public.audit_logs, public.disputes
  from anon, authenticated;

-- Sequences are not used (all keys are uuid), so nothing to grant there.
