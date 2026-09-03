# SwiftBuy Rwanda

E-commerce marketplace platform for Rwanda — Final Year Project  
**Ghislaine Fladery IWENGA & ELI Z. WHAPOE** · UTB University · Supervisor: MUNYANA Penina

---

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Demo Accounts (localStorage mode)

| Role        | Email                     | Password    |
|-------------|---------------------------|-------------|
| Super Admin | superadmin@swiftbuy.rw    | admin123    |
| Admin       | admin@swiftbuy.rw         | admin123    |
| Seller      | gigi@seller.rw            | seller123   |
| Customer    | amina@user.rw             | user123     |

---

## Connecting to Supabase (go live)

### Step 1 — Create a free Supabase project
1. Go to https://supabase.com and sign up (free)
2. Click **New project** — give it a name, pick a region closest to Rwanda (e.g. Europe West)
3. Wait for the project to be ready (~1 minute)

### Step 2 — Run the database schema
1. In Supabase, go to **SQL Editor** → **New query**
2. Copy the entire contents of `supabase-schema.sql` (in the project root)
3. Paste and click **Run**
4. All tables, policies, and triggers will be created automatically

### Step 3 — Get your API credentials
1. Go to **Settings → API** in your Supabase project
2. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (the long JWT string)

### Step 4 — Configure the app
1. Copy `.env.example` to `.env` in the project root
2. Fill in your credentials:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```
3. Restart the dev server: `npm run dev`

### Step 5 — Create the Super Admin account
1. In Supabase → **Authentication → Users → Invite user**
2. Enter email: `superadmin@swiftbuy.rw`
3. After signup, run this in SQL Editor:
   ```sql
   update public.users set role = 'superadmin'
   where email = 'superadmin@swiftbuy.rw';
   ```

### Step 6 — Set up image storage
1. In Supabase → **Storage → New bucket**
2. Name: `product-images`
3. Set to **Public bucket** (so product images load for all users)

---

## Deploying (free)

**Vercel (recommended):**
```bash
npm install -g vercel
vercel
```
Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.

**Netlify:** Same process — drag the `dist` folder or connect your GitHub repo.

---

## Project Structure

```
src/
├── lib/
│   └── supabase.js          ← Supabase client
├── context/
│   ├── AuthContext.jsx      ← Auth (Supabase + localStorage fallback)
│   └── ToastContext.jsx     ← Global notifications
├── services/
│   └── storage.js           ← All data operations (Supabase + localStorage)
├── components/
│   ├── Navbar.jsx           ← Sticky nav with mobile hamburger menu
│   ├── ProtectedRoute.jsx   ← Role-based route guard
│   └── UI.jsx               ← Shared components
└── pages/
    ├── Home.jsx             ← Shop front
    ├── ProductDetail.jsx    ← Product detail + reviews
    ├── Cart.jsx             ← Cart → checkout flow
    ├── Orders.jsx           ← Customer orders
    ├── SellerDashboard.jsx  ← Seller order management
    ├── SellerProducts.jsx   ← Product CRUD
    ├── SellerAnalytics.jsx  ← Revenue charts
    ├── AdminDashboard.jsx   ← Platform management
    └── ...
```

---

## Roles

| Role        | What they can do |
|-------------|------------------|
| Customer    | Browse, buy, review, chat with sellers |
| Seller      | List products, manage orders, view analytics |
| Admin       | Approve sellers, manage orders, feature products |
| Super Admin | Everything above + manage admin accounts |
