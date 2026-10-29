import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/server/db.server";
import { access, assertOpen, earningsFor, num, orderRef, rateFor, requireMember, round2, type OrgRow } from "@/server/ctx.server";

const id = z.string().uuid();

type ProductRow = { id: string; name: string; category: string; unit: string; price: string; commission_rate: string | null; stock: number | null; description: string | null; sku: string | null };

/** Products a reseller can sell, with what they earn on each. */
export const getSellCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { org, m, db } = await requireMember(["owner", "manager", "reseller"]);
  const [tier] = await db<{ commission_rate: string }[]>`select commission_rate from tiers where id = ${m.tier_id}`;
  const products = await db<ProductRow[]>`
    select id, name, category, unit, price, commission_rate, stock, description, sku from products
    where org_id = ${org.id} and active order by category, sort, name`;
  const member = { commission_override: m.commission_override, tier_rate: tier?.commission_rate ?? null };
  return {
    currency: org.currency,
    products: products.map((p) => {
      const r = m.role === "reseller" ? rateFor(p, member, org) : 0;
      return { ...p, price: num(p.price), rate: r, earn: round2((num(p.price) * r) / 100) };
    }),
  };
});

const itemsShape = z.array(z.object({ productId: id, qty: z.number().int().min(1).max(10_000) })).min(1).max(50);

/** Shared order creation used by resellers and storefronts. Prices and commission are always computed here. */
async function createOrder(
  db: Awaited<ReturnType<typeof sql>>,
  org: OrgRow,
  resellerId: string | null,
  input: { customerName: string; customerPhone?: string | null; note?: string | null; items: { productId: string; qty: number }[] },
  source: "reseller" | "storefront" | "office",
) {
  assertOpen(org);
  let member = { commission_override: null as string | null, tier_rate: null as string | null };
  if (resellerId) {
    const [r] = await db<{ commission_override: string | null; tier_rate: string | null }[]>`
      select m.commission_override, t.commission_rate as tier_rate from memberships m left join tiers t on t.id = m.tier_id where m.id = ${resellerId}`;
    member = r;
  }
  const ids = input.items.map((i) => i.productId);
  return db.begin(async (tx) => {
    const products = await tx<(ProductRow & { active: boolean })[]>`
      select * from products where org_id = ${org.id} and id = any(${ids}::uuid[]) for update`;
    const byId = new Map(products.map((p) => [p.id, p]));
    let total = 0;
    let commission = 0;
    const lines = input.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p || !p.active) throw new Error("One of the products is no longer for sale. Remove it and try again.");
      if (p.stock != null && p.stock < i.qty) throw new Error(`Only ${p.stock} ${p.unit} of ${p.name} left in stock.`);
      const lineTotal = round2(num(p.price) * i.qty);
      const c = resellerId ? round2((lineTotal * rateFor(p, member, org)) / 100) : 0;
      total += lineTotal;
      commission += c;
      return { p, qty: i.qty, lineTotal, c };
    });
    const ref = orderRef();
    const [o] = await tx<{ id: string }[]>`
      insert into orders (org_id, ref, reseller_id, customer_name, customer_phone, note, source, total, commission)
      values (${org.id}, ${ref}, ${resellerId}, ${input.customerName}, ${input.customerPhone ?? null}, ${input.note ?? null}, ${source}, ${round2(total)}, ${round2(commission)})
      returning id`;
    for (const l of lines) {
      await tx`insert into order_items (order_id, product_id, name, unit_price, qty, line_total, commission)
        values (${o.id}, ${l.p.id}, ${l.p.name}, ${l.p.price}, ${l.qty}, ${l.lineTotal}, ${l.c})`;
      if (l.p.stock != null) await tx`update products set stock = stock - ${l.qty} where id = ${l.p.id}`;
    }
    return { ref, total: round2(total), commission: round2(commission) };
  });
}

export const placeSale = createServerFn({ method: "POST" })
  .validator(
    z.object({
      customerName: z.string().trim().min(2, "Enter the customer's name.").max(80),
      customerPhone: z.string().trim().max(20).optional(),
      note: z.string().trim().max(300).optional(),
      items: itemsShape,
    }),
  )
  .handler(async ({ data }) => {
    const { org, m, db } = await requireMember(["owner", "manager", "reseller"]);
    return createOrder(db, org, m.role === "reseller" ? m.id : null, data, m.role === "reseller" ? "reseller" : "office");
  });

export const getMyDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { org, m, db, s } = await requireMember(["reseller"], { allowPending: true });
  const [tier] = await db<{ name: string; commission_rate: string }[]>`select name, commission_rate from tiers where id = ${m.tier_id}`;
  const earnings = await earningsFor(db, m.id);
  const [month] = await db<{ sales: string; orders: string }[]>`
    select coalesce(sum(total), 0) as sales, count(*) as orders from orders
    where reseller_id = ${m.id} and status <> 'cancelled' and created_at >= date_trunc('month', now())`;
  const rank = await db<{ id: string; sales: string }[]>`
    select m.id, coalesce(sum(o.total), 0) as sales from memberships m
    left join orders o on o.reseller_id = m.id and o.status <> 'cancelled' and o.created_at >= date_trunc('month', now())
    where m.org_id = ${org.id} and m.role = 'reseller' and m.status = 'active' group by m.id order by sales desc`;
  const position = rank.findIndex((r) => r.id === m.id) + 1;
  const announcements = await db<{ id: string; title: string; body: string; pinned: boolean; created_at: Date }[]>`
    select id, title, body, pinned, created_at from announcements where org_id = ${org.id} order by pinned desc, created_at desc limit 3`;
  return {
    name: s.user.name,
    status: m.status,
    code: m.code,
    orgSlug: org.slug,
    currency: org.currency,
    tier: tier ? { name: tier.name, rate: num(tier.commission_rate) } : null,
    rate: m.commission_override != null ? num(m.commission_override) : tier ? num(tier.commission_rate) : num(org.default_commission),
    earnings,
    month: { sales: num(month.sales), orders: num(month.orders) },
    rank: position > 0 ? { position, of: rank.length } : null,
    announcements,
    payout: { method: m.payout_method, details: m.payout_details },
  };
});

export const listMyOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { m, db } = await requireMember(["reseller"]);
  const rows = await db<{ id: string; ref: string; customer_name: string; customer_phone: string | null; status: string; paid: boolean; total: string; commission: string; source: string; created_at: Date; items: { name: string; qty: number }[] }[]>`
    select o.id, o.ref, o.customer_name, o.customer_phone, o.status, o.paid, o.total, o.commission, o.source, o.created_at,
      (select json_agg(json_build_object('name', i.name, 'qty', i.qty)) from order_items i where i.order_id = o.id) as items
    from orders o where o.reseller_id = ${m.id} order by o.created_at desc limit 300`;
  return rows.map((r) => ({ ...r, total: num(r.total), commission: num(r.commission), items: r.items ?? [] }));
});

export const listMyPayouts = createServerFn({ method: "GET" }).handler(async () => {
  const { m, db } = await requireMember(["reseller"]);
  const rows = await db<{ id: string; amount: string; method: string; destination: string; status: string; reference: string | null; note: string | null; created_at: Date }[]>`
    select id, amount, method, destination, status, reference, note, created_at from payouts where membership_id = ${m.id} order by created_at desc`;
  return { earnings: await earningsFor(db, m.id), payout: { method: m.payout_method, details: m.payout_details }, rows: rows.map((r) => ({ ...r, amount: num(r.amount) })) };
});

const MIN_PAYOUT = 100;

export const requestPayout = createServerFn({ method: "POST" })
  .validator(z.object({ amount: z.number().positive(), method: z.enum(["mpesa", "bank"]), destination: z.string().trim().min(6, "Enter where to send the money.").max(200) }))
  .handler(async ({ data }) => {
    const { org, m, db } = await requireMember(["reseller"]);
    if (data.amount < MIN_PAYOUT) throw new Error(`The smallest payout is ${org.currency} ${MIN_PAYOUT}.`);
    await db.begin(async (tx) => {
      await tx`select id from memberships where id = ${m.id} for update`;
      const e = await earningsFor(tx as never, m.id);
      if (data.amount > e.available) throw new Error(`You can request up to ${org.currency} ${e.available.toFixed(2)}.`);
      await tx`insert into payouts (org_id, membership_id, amount, method, destination) values (${org.id}, ${m.id}, ${round2(data.amount)}, ${data.method}, ${data.destination})`;
      await tx`update memberships set payout_method = ${data.method}, payout_details = ${data.destination} where id = ${m.id}`;
    });
    return { ok: true };
  });

/* ======================= Public storefront ======================= */

export const getStorefront = createServerFn({ method: "GET" })
  .validator(z.object({ org: z.string().max(60), code: z.string().max(20) }))
  .handler(async ({ data }) => {
    const db = await sql();
    const [org] = await db<OrgRow[]>`select * from orgs where slug = ${data.org}`;
    if (!org) return null;
    const [seller] = await db<{ id: string; name: string; phone: string | null; region: string | null }[]>`
      select m.id, u.name, u.phone, m.region from memberships m join users u on u.id = m.user_id
      where m.org_id = ${org.id} and upper(m.code) = upper(${data.code}) and m.status = 'active'`;
    if (!seller) return null;
    const products = await db<ProductRow[]>`
      select id, name, category, unit, price, commission_rate, stock, description, sku from products
      where org_id = ${org.id} and active order by category, sort, name`;
    return {
      company: { name: org.name, industry: org.industry, welcome: org.welcome, currency: org.currency },
      seller: { name: seller.name, phone: seller.phone, region: seller.region },
      open: access(org).open,
      products: products.map((p) => ({ id: p.id, name: p.name, category: p.category, unit: p.unit, price: num(p.price), stock: p.stock, description: p.description })),
    };
  });

export const placeStorefrontOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      org: z.string().max(60),
      code: z.string().max(20),
      customerName: z.string().trim().min(2, "Enter your name.").max(80),
      customerPhone: z.string().trim().min(9, "Enter a phone number so the seller can reach you.").max(20),
      note: z.string().trim().max(300).optional(),
      items: itemsShape,
    }),
  )
  .handler(async ({ data }) => {
    const db = await sql();
    const [org] = await db<OrgRow[]>`select * from orgs where slug = ${data.org}`;
    if (!org) throw new Error("This store doesn't exist.");
    const [seller] = await db<{ id: string }[]>`select id from memberships where org_id = ${org.id} and upper(code) = upper(${data.code}) and status = 'active'`;
    if (!seller) throw new Error("This seller isn't taking orders right now.");
    return createOrder(db, org, seller.id, data, "storefront");
  });
