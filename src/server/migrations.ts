/**
 * Database migrations, embedded so they ship with every build.
 * Each runs once, in order, inside a transaction. Never edit a released one — add a new entry.
 */
export const migrations: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: /* sql */ `
create extension if not exists pgcrypto;
create extension if not exists citext;

create table users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  phone text,
  password_hash text not null,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table plans (
  id text primary key,
  name text not null,
  price_monthly integer not null,          -- KES
  reseller_limit integer,                  -- null = unlimited
  product_limit integer,
  staff_limit integer,
  blurb text not null,
  features jsonb not null default '[]',
  sort integer not null default 0
);

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text not null default 'Other',
  currency text not null default 'KES',
  plan_id text not null references plans(id) default 'growth',
  status text not null default 'trialing' check (status in ('trialing','active','past_due','cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  join_code text not null unique,
  default_commission numeric(5,2) not null default 10,
  welcome text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table sessions (
  id text primary key,                     -- sha256 of the cookie token
  user_id uuid not null references users(id) on delete cascade,
  org_id uuid references orgs(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on sessions(user_id);

create table tiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  commission_rate numeric(5,2) not null,
  sort integer not null default 0
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','manager','reseller')),
  status text not null default 'active' check (status in ('active','pending','suspended')),
  code text not null,                      -- reseller's public code, used in their store link
  tier_id uuid references tiers(id) on delete set null,
  commission_override numeric(5,2),
  region text,
  payout_method text check (payout_method in ('mpesa','bank')),
  payout_details text,
  created_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, code)
);
create index memberships_user on memberships(user_id);

create table products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  sku text,
  category text not null default 'General',
  unit text not null default 'item',
  price numeric(12,2) not null check (price >= 0),
  commission_rate numeric(5,2),
  stock integer,
  active boolean not null default true,
  description text,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index products_org on products(org_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  ref text not null unique,
  reseller_id uuid references memberships(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  note text,
  source text not null default 'reseller' check (source in ('reseller','storefront','office')),
  status text not null default 'new' check (status in ('new','confirmed','fulfilled','cancelled')),
  paid boolean not null default false,
  total numeric(12,2) not null,
  commission numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_org on orders(org_id, created_at desc);
create index orders_reseller on orders(reseller_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  unit_price numeric(12,2) not null,
  qty integer not null check (qty > 0),
  line_total numeric(12,2) not null,
  commission numeric(12,2) not null default 0
);
create index order_items_order on order_items(order_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  membership_id uuid not null references memberships(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('mpesa','bank')),
  destination text not null,
  status text not null default 'requested' check (status in ('requested','paid','rejected')),
  reference text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payouts_org on payouts(org_id, created_at desc);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create table subscription_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan_id text not null references plans(id),
  months integer not null check (months in (1, 12)),
  amount integer not null,
  method text not null check (method in ('mpesa_stk','mpesa_manual','bank')),
  status text not null default 'pending' check (status in ('pending','confirmed','failed','rejected')),
  reference text,
  phone text,
  checkout_request_id text unique,
  raw jsonb,
  submitted_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index sub_payments_reference on subscription_payments(upper(reference)) where status = 'confirmed' and reference is not null;

insert into plans (id, name, price_monthly, reseller_limit, product_limit, staff_limit, blurb, features, sort) values
 ('starter', 'Starter', 2900, 25, 50, 1, 'For a first reseller team getting organised.',
  '["Up to 25 resellers","Up to 50 products","1 staff account","Every feature included","Help on WhatsApp"]', 1),
 ('growth', 'Growth', 7900, 150, 500, 5, 'For networks selling every day across regions.',
  '["Up to 150 resellers","Up to 500 products","5 staff accounts","Every feature included","Help on WhatsApp"]', 2),
 ('scale', 'Scale', 19900, null, null, null, 'For national networks with thousands of sellers.',
  '["Unlimited resellers","Unlimited products","Unlimited staff","Every feature included","Priority help and onboarding for your team"]', 3);
`,
  },
];
