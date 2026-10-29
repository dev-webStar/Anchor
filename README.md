# Anchor Hub — reseller system

Software for any company that sells through a network of resellers, in any industry.
A company subscribes monthly (M-Pesa or bank) and gets one place to:

- **Recruit**: a join link resellers sign up with, plus approvals, holds and starter passwords
- **Catalogue**: products, prices, units and optional stock tracking, grouped into coloured category lines
- **Orders**: recorded by resellers, placed by customers on each reseller's store link, or entered at the office
- **Commissions**: company default, tiers (Bronze, Silver, Gold…), personal rates and per-product rates
- **Payouts**: resellers request their earnings, and the company pays by M-Pesa or bank and records the reference
- **Announcements**: posted once and shown on every reseller's home screen
- **Reports**: 30-day sales, a network map by region, a leaderboard and best-selling products
- **Billing**: a 14-day trial, three plans, and payment by M-Pesa prompt, Paybill or bank transfer
- **Anchor admin**: for platform staff to confirm payments, see every company and extend trials

The logo is an anchor drawn like a transit map in a red seal: the ring is a station, the flukes end in yellow stations.
The same idea runs through the product: the reseller network is drawn as a colourful rail map, navigation is a line of
stations with a colour each, and products are keys you press on a board.

## Run it on your computer

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. On the first run a local Postgres database is created in `.anchor-db/`
and filled with a demo company. Sign in with:

| Who | Email | Password |
| --- | --- | --- |
| Company owner | owner@savanna.test | anchor-demo |
| Reseller | wanjiku@savanna.test | anchor-demo |
| Anchor staff | admin@anchor.test | anchor-admin |

A reseller's store: http://localhost:3000/s/savanna-naturals/WANJ7K. The join link is http://localhost:3000/join/SAVANNA8.
To start over, stop the server and delete the `.anchor-db` folder.

## Go live

1. Create a Postgres database (Supabase, Neon, Railway, or your own) and put its connection string in `DATABASE_URL`.
   Tables are created automatically on first start.
2. Fill in the payment details in `.env` (see `.env.example`): your Paybill or Till, and your bank account.
   These are shown to companies on their Billing page.
3. Optional: add Safaricom Daraja keys for M-Pesa prompts. Payments then confirm themselves via
   `/api/mpesa/callback`.
4. Make yourself Anchor staff: sign up, then run
   `update users set is_platform_admin = true where email = 'you@example.com';`
5. Build and run:

```bash
npm run build                      # Node server (default)
npm start
NITRO_PRESET=vercel npm run build  # or Vercel / netlify / render-com / railway
```

## How the pieces fit

```
src/server/        database, migrations, sessions and passwords, M-Pesa, billing rules (server only)
src/lib/api/       server functions the screens call: auth, org (company), seller, billing
src/components/    design kit, the product machine, network map, app shell
src/routes/        /            home page
                   /signup /login /join/$code
                   /app/*       company and reseller screens (role decides what shows)
                   /s/$org/$code  a reseller's public store
                   /platform    Anchor staff
```

Money rules live on the server: prices and commission are computed when an order is saved, stock is
locked in the same transaction, payouts can't exceed fulfilled earnings, and an M-Pesa code or bank
reference can only confirm one subscription payment.
"# Anchor" 
