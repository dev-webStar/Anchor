import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashPassword } from "@/server/auth.server";
import { code, earningsFor, num, requireManager, requireMember, round2, uniqueMemberCode } from "@/server/ctx.server";

const id = z.string().uuid();
const money = z.number().min(0).max(100_000_000);
const rate = z.number().min(0).max(100);

/* ======================= Overview ======================= */

export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireManager();
  const [totals] = await db<{ sales30: string; orders30: string; commission_owed: string; open_orders: string }[]>`
    select coalesce(sum(total) filter (where status <> 'cancelled' and created_at > now() - interval '30 days'), 0) as sales30,
           count(*) filter (where status <> 'cancelled' and created_at > now() - interval '30 days') as orders30,
           coalesce(sum(commission) filter (where status = 'fulfilled'), 0) as commission_owed,
           count(*) filter (where status in ('new','confirmed')) as open_orders
    from orders where org_id = ${org.id}`;
  const [paid] = await db<{ paid: string; requested: string; requests: string }[]>`
    select coalesce(sum(amount) filter (where status = 'paid'), 0) as paid,
           coalesce(sum(amount) filter (where status = 'requested'), 0) as requested,
           count(*) filter (where status = 'requested') as requests
    from payouts where org_id = ${org.id}`;
  const [people] = await db<{ active: string; pending: string }[]>`
    select count(*) filter (where status = 'active') as active, count(*) filter (where status = 'pending') as pending
    from memberships where org_id = ${org.id} and role = 'reseller'`;
  const daily = await db<{ day: Date; sales: string; orders: string }[]>`
    select d::date as day, coalesce(sum(o.total), 0) as sales, count(o.id) as orders
    from generate_series(current_date - 29, current_date, interval '1 day') d
    left join orders o on o.org_id = ${org.id} and o.status <> 'cancelled' and o.created_at::date = d::date
    group by d order by d`;
  const leaders = await db<{ id: string; name: string; code: string; region: string | null; sales: string; orders: string }[]>`
    select m.id, u.name, m.code, m.region, coalesce(sum(o.total), 0) as sales, count(o.id) as orders
    from memberships m join users u on u.id = m.user_id
    left join orders o on o.reseller_id = m.id and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
    where m.org_id = ${org.id} and m.role = 'reseller' and m.status = 'active'
    group by m.id, u.name order by sales desc limit 8`;
  const topProducts = await db<{ name: string; qty: string; sales: string }[]>`
    select i.name, sum(i.qty) as qty, sum(i.line_total) as sales
    from order_items i join orders o on o.id = i.order_id
    where o.org_id = ${org.id} and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
    group by i.name order by sales desc limit 5`;
  const [counts] = await db<{ products: string; announcements: string }[]>`
    select (select count(*) from products where org_id = ${org.id}) as products,
           (select count(*) from announcements where org_id = ${org.id}) as announcements`;
  return {
    sales30: num(totals.sales30),
    orders30: num(totals.orders30),
    openOrders: num(totals.open_orders),
    commissionOwed: round2(num(totals.commission_owed) - num(paid.paid)),
    payoutRequests: num(paid.requests),
    payoutRequested: num(paid.requested),
    resellers: num(people.active),
    pendingResellers: num(people.pending),
    products: num(counts.products),
    announcements: num(counts.announcements),
    daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), sales: num(d.sales), orders: num(d.orders) })),
    leaders: leaders.map((l) => ({ ...l, sales: num(l.sales), orders: num(l.orders) })),
    topProducts: topProducts.map((p) => ({ name: p.name, qty: num(p.qty), sales: num(p.sales) })),
  };
});

/* ======================= Orders ======================= */

export const listOrders = createServerFn({ method: "GET" })
  .validator(z.object({ status: z.enum(["open", "fulfilled", "cancelled", "all"]).default("open"), q: z.string().max(80).optional(), days: z.number().int().min(1).max(365).default(30) }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    const statuses = data.status === "open" ? ["new", "confirmed"] : data.status === "all" ? ["new", "confirmed", "fulfilled", "cancelled"] : [data.status];
    const q = data.q ? `%${data.q}%` : null;
    const rows = await db<
      { id: string; ref: string; customer_name: string; customer_phone: string | null; note: string | null; source: string; status: string; paid: boolean; total: string; commission: string; created_at: Date; reseller: string | null; reseller_code: string | null; items: { name: string; qty: number; unit_price: string }[] }[]
    >`
      select o.*, u.name as reseller, m.code as reseller_code,
        (select json_agg(json_build_object('name', i.name, 'qty', i.qty, 'unit_price', i.unit_price)) from order_items i where i.order_id = o.id) as items
      from orders o
      left join memberships m on m.id = o.reseller_id
      left join users u on u.id = m.user_id
      where o.org_id = ${org.id} and o.status = any(${statuses})
        and o.created_at > now() - ${`${data.days} days`}::interval
        and (${q}::text is null or o.ref ilike ${q} or o.customer_name ilike ${q} or o.customer_phone ilike ${q} or u.name ilike ${q})
      order by o.created_at desc limit 500`;
    return rows.map((r) => ({ ...r, total: num(r.total), commission: num(r.commission), items: r.items ?? [] }));
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: id, status: z.enum(["confirmed", "fulfilled", "cancelled"]) }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    const allowedFrom: Record<string, string[]> = { confirmed: ["new"], fulfilled: ["new", "confirmed"], cancelled: ["new", "confirmed"] };
    const done = await db.begin(async (tx) => {
      const [o] = await tx<{ id: string }[]>`
        update orders set status = ${data.status}, updated_at = now()
        where id = ${data.orderId} and org_id = ${org.id} and status = any(${allowedFrom[data.status]}) returning id`;
      if (!o) return false;
      if (data.status === "cancelled") {
        // Return stock for tracked products.
        await tx`update products p set stock = p.stock + i.qty from order_items i where i.order_id = ${o.id} and i.product_id = p.id and p.stock is not null`;
      }
      return true;
    });
    if (!done) throw new Error("This order can't move to that status. Refresh and try again.");
    return { ok: true };
  });

export const setOrderPaid = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: id, paid: z.boolean() }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    await db`update orders set paid = ${data.paid}, updated_at = now() where id = ${data.orderId} and org_id = ${org.id}`;
    return { ok: true };
  });

/* ======================= Resellers ======================= */

export const listResellers = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireManager();
  const rows = await db<
    { id: string; role: string; status: string; code: string; region: string | null; tier_id: string | null; tier_name: string | null; tier_rate: string | null; commission_override: string | null; payout_method: string | null; payout_details: string | null; created_at: Date; name: string; email: string; phone: string | null; sales: string; orders: string; earned: string; paid: string }[]
  >`
    select m.id, m.role, m.status, m.code, m.region, m.tier_id, t.name as tier_name, t.commission_rate as tier_rate, m.commission_override,
           m.payout_method, m.payout_details, m.created_at, u.name, u.email, u.phone,
           coalesce((select sum(total) from orders o where o.reseller_id = m.id and o.status <> 'cancelled'), 0) as sales,
           (select count(*) from orders o where o.reseller_id = m.id and o.status <> 'cancelled') as orders,
           coalesce((select sum(commission) from orders o where o.reseller_id = m.id and o.status = 'fulfilled'), 0) as earned,
           coalesce((select sum(amount) from payouts p where p.membership_id = m.id and p.status = 'paid'), 0) as paid
    from memberships m join users u on u.id = m.user_id left join tiers t on t.id = m.tier_id
    where m.org_id = ${org.id}
    order by (m.status = 'pending') desc, m.created_at desc`;
  const tiers = await db<{ id: string; name: string; commission_rate: string }[]>`select id, name, commission_rate from tiers where org_id = ${org.id} order by sort`;
  return {
    joinCode: org.join_code,
    defaultCommission: num(org.default_commission),
    tiers: tiers.map((t) => ({ ...t, commission_rate: num(t.commission_rate) })),
    people: rows.map((r) => ({
      ...r,
      tier_rate: r.tier_rate == null ? null : num(r.tier_rate),
      commission_override: r.commission_override == null ? null : num(r.commission_override),
      sales: num(r.sales),
      orders: num(r.orders),
      earned: num(r.earned),
      paid: num(r.paid),
    })),
  };
});

export const updateReseller = createServerFn({ method: "POST" })
  .validator(
    z.object({
      membershipId: id,
      status: z.enum(["active", "suspended"]).optional(),
      tierId: id.nullable().optional(),
      commissionOverride: rate.nullable().optional(),
      region: z.string().trim().max(60).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { org, db, m: me } = await requireManager();
    const [target] = await db<{ role: string; status: string; user_id: string }[]>`select role, status, user_id from memberships where id = ${data.membershipId} and org_id = ${org.id}`;
    if (!target) throw new Error("Reseller not found.");
    if (target.role === "owner") throw new Error("The owner's access can't be changed.");
    if (target.user_id === me.user_id) throw new Error("You can't change your own access.");

    if (data.status === "active" && target.status !== "active") {
      const [plan] = await db<{ reseller_limit: number | null }[]>`select reseller_limit from plans where id = ${org.plan_id}`;
      if (plan.reseller_limit != null) {
        const [c] = await db<{ n: string }[]>`select count(*) as n from memberships where org_id = ${org.id} and role = 'reseller' and status = 'active'`;
        if (num(c.n) >= plan.reseller_limit) throw new Error(`Your plan allows ${plan.reseller_limit} active resellers. Upgrade on the Billing page to add more.`);
      }
    }
    if (data.tierId) {
      const [t] = await db`select 1 from tiers where id = ${data.tierId} and org_id = ${org.id}`;
      if (!t) throw new Error("Unknown tier.");
    }
    await db`
      update memberships set
        status = coalesce(${data.status ?? null}, status),
        tier_id = ${data.tierId === undefined ? db`tier_id` : data.tierId},
        commission_override = ${data.commissionOverride === undefined ? db`commission_override` : data.commissionOverride},
        region = ${data.region === undefined ? db`region` : data.region}
      where id = ${data.membershipId}`;
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .validator(z.object({ membershipId: id }))
  .handler(async ({ data }) => {
    const { org, db, m: me } = await requireManager();
    const [t] = await db<{ role: string; user_id: string }[]>`select role, user_id from memberships where id = ${data.membershipId} and org_id = ${org.id}`;
    if (!t) throw new Error("Not found.");
    if (t.role === "owner" || t.user_id === me.user_id) throw new Error("You can't remove this account.");
    await db`delete from memberships where id = ${data.membershipId}`;
    return { ok: true };
  });

/** Set a temporary password for a reseller or staff member who forgot theirs. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .validator(z.object({ membershipId: id }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    const [t] = await db<{ role: string; user_id: string }[]>`select role, user_id from memberships where id = ${data.membershipId} and org_id = ${org.id}`;
    if (!t || t.role === "owner") throw new Error("You can't reset this account's password.");
    const [shared] = await db<{ n: string }[]>`select count(*) as n from memberships where user_id = ${t.user_id}`;
    if (num(shared.n) > 1) throw new Error("This person also works with another company. Ask them to change their password from their profile.");
    const temp = `${code(4)}-${code(4)}`.toLowerCase();
    await db`update users set password_hash = ${await hashPassword(temp)} where id = ${t.user_id}`;
    await db`delete from sessions where user_id = ${t.user_id}`;
    return { password: temp };
  });

/** Add a reseller or manager directly (instead of the join link). */
export const addMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      role: z.enum(["reseller", "manager"]),
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      phone: z.string().trim().min(9).max(20),
      region: z.string().trim().max(60).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { org, db } = await requireMember(["owner"]);
    const [plan] = await db<{ reseller_limit: number | null; staff_limit: number | null }[]>`select reseller_limit, staff_limit from plans where id = ${org.plan_id}`;
    const limit = data.role === "reseller" ? plan.reseller_limit : plan.staff_limit;
    if (limit != null) {
      const [c] = await db<{ n: string }[]>`select count(*) as n from memberships where org_id = ${org.id} and role = ${data.role} and status = 'active'`;
      if (num(c.n) >= limit) throw new Error(`Your plan allows ${limit} ${data.role === "reseller" ? "active resellers" : "staff accounts"}. Upgrade on the Billing page.`);
    }
    let [u] = await db<{ id: string }[]>`select id from users where email = ${data.email}`;
    let temp: string | null = null;
    if (!u) {
      temp = `${code(4)}-${code(4)}`.toLowerCase();
      [u] = await db<{ id: string }[]>`insert into users (email, name, phone, password_hash) values (${data.email}, ${data.name}, ${data.phone}, ${await hashPassword(temp)}) returning id`;
    }
    const [dup] = await db`select 1 from memberships where org_id = ${org.id} and user_id = ${u.id}`;
    if (dup) throw new Error("This person is already part of your company.");
    const [tier] = await db<{ id: string }[]>`select id from tiers where org_id = ${org.id} order by sort limit 1`;
    await db`
      insert into memberships (org_id, user_id, role, status, code, tier_id, region)
      values (${org.id}, ${u.id}, ${data.role}, 'active', ${await uniqueMemberCode(db, org.id, data.name)}, ${data.role === "reseller" ? tier?.id ?? null : null}, ${data.region ?? null})`;
    return { tempPassword: temp };
  });

export const rotateJoinCode = createServerFn({ method: "POST" }).handler(async () => {
  const { org, db } = await requireMember(["owner"]);
  const c = code(8);
  await db`update orgs set join_code = ${c} where id = ${org.id}`;
  return { joinCode: c };
});

/* ======================= Tiers ======================= */

export const saveTiers = createServerFn({ method: "POST" })
  .validator(z.object({ defaultCommission: rate, tiers: z.array(z.object({ id: id.optional(), name: z.string().trim().min(1).max(30), commission_rate: rate })).max(8) }))
  .handler(async ({ data }) => {
    const { org, db } = await requireMember(["owner"]);
    await db.begin(async (tx) => {
      await tx`update orgs set default_commission = ${data.defaultCommission} where id = ${org.id}`;
      const keep = data.tiers.filter((t) => t.id).map((t) => t.id!);
      await tx`delete from tiers where org_id = ${org.id} and not (id = any(${keep}))`;
      for (const [i, t] of data.tiers.entries()) {
        if (t.id) await tx`update tiers set name = ${t.name}, commission_rate = ${t.commission_rate}, sort = ${i} where id = ${t.id} and org_id = ${org.id}`;
        else await tx`insert into tiers (org_id, name, commission_rate, sort) values (${org.id}, ${t.name}, ${t.commission_rate}, ${i})`;
      }
    });
    return { ok: true };
  });

/* ======================= Products ======================= */

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireManager();
  const rows = await db<{ id: string; name: string; sku: string | null; category: string; unit: string; price: string; commission_rate: string | null; stock: number | null; active: boolean; description: string | null; sort: number; sold30: string }[]>`
    select p.*, coalesce((select sum(i.qty) from order_items i join orders o on o.id = i.order_id
      where i.product_id = p.id and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'), 0) as sold30
    from products p where p.org_id = ${org.id} order by p.category, p.sort, p.name`;
  return rows.map((r) => ({ ...r, price: num(r.price), commission_rate: r.commission_rate == null ? null : num(r.commission_rate), sold30: num(r.sold30) }));
});

export const saveProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: id.optional(),
      name: z.string().trim().min(1).max(100),
      sku: z.string().trim().max(40).nullable(),
      category: z.string().trim().min(1).max(40),
      unit: z.string().trim().min(1).max(20),
      price: money,
      commission_rate: rate.nullable(),
      stock: z.number().int().min(0).nullable(),
      active: z.boolean(),
      description: z.string().trim().max(500).nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    if (!data.id) {
      const [plan] = await db<{ product_limit: number | null }[]>`select product_limit from plans where id = ${org.plan_id}`;
      if (plan.product_limit != null) {
        const [c] = await db<{ n: string }[]>`select count(*) as n from products where org_id = ${org.id}`;
        if (num(c.n) >= plan.product_limit) throw new Error(`Your plan allows ${plan.product_limit} products. Upgrade on the Billing page.`);
      }
    }
    const row = { ...data, price: round2(data.price) };
    if (data.id) {
      await db`update products set name = ${row.name}, sku = ${row.sku}, category = ${row.category}, unit = ${row.unit}, price = ${row.price},
        commission_rate = ${row.commission_rate}, stock = ${row.stock}, active = ${row.active}, description = ${row.description}
        where id = ${data.id} and org_id = ${org.id}`;
    } else {
      await db`insert into products (org_id, name, sku, category, unit, price, commission_rate, stock, active, description)
        values (${org.id}, ${row.name}, ${row.sku}, ${row.category}, ${row.unit}, ${row.price}, ${row.commission_rate}, ${row.stock}, ${row.active}, ${row.description})`;
    }
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    await db`delete from products where id = ${data.id} and org_id = ${org.id}`;
    return { ok: true };
  });

/* ======================= Payouts ======================= */

export const listPayouts = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireManager();
  const rows = await db<{ id: string; amount: string; method: string; destination: string; status: string; reference: string | null; note: string | null; created_at: Date; paid_at: Date | null; name: string; code: string; membership_id: string }[]>`
    select p.*, u.name, m.code from payouts p join memberships m on m.id = p.membership_id join users u on u.id = m.user_id
    where p.org_id = ${org.id} order by (p.status = 'requested') desc, p.created_at desc limit 300`;
  return rows.map((r) => ({ ...r, amount: num(r.amount) }));
});

export const settlePayout = createServerFn({ method: "POST" })
  .validator(z.object({ id, action: z.enum(["paid", "rejected"]), reference: z.string().trim().max(60).optional(), note: z.string().trim().max(200).optional() }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    if (data.action === "paid" && !data.reference) throw new Error("Enter the M-Pesa or bank reference for this payment.");
    const [p] = await db`
      update payouts set status = ${data.action}, reference = ${data.reference ?? null}, note = ${data.note ?? null},
        paid_at = ${data.action === "paid" ? db`now()` : null}
      where id = ${data.id} and org_id = ${org.id} and status = 'requested' returning id`;
    if (!p) throw new Error("This request was already handled.");
    return { ok: true };
  });

/* ======================= Announcements ======================= */

export const listAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireMember();
  return db<{ id: string; title: string; body: string; pinned: boolean; created_at: Date; author: string | null }[]>`
    select a.id, a.title, a.body, a.pinned, a.created_at, u.name as author
    from announcements a left join users u on u.id = a.author_id
    where a.org_id = ${org.id} order by a.pinned desc, a.created_at desc limit 50`;
});

export const postAnnouncement = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().trim().min(2).max(100), body: z.string().trim().min(2).max(2000), pinned: z.boolean() }))
  .handler(async ({ data }) => {
    const { org, db, s } = await requireManager();
    if (data.pinned) await db`update announcements set pinned = false where org_id = ${org.id}`;
    await db`insert into announcements (org_id, author_id, title, body, pinned) values (${org.id}, ${s.user.id}, ${data.title}, ${data.body}, ${data.pinned})`;
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    await db`delete from announcements where id = ${data.id} and org_id = ${org.id}`;
    return { ok: true };
  });

/* ======================= Company settings ======================= */

export const saveCompany = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(80),
      industry: z.string().trim().min(2).max(60),
      welcome: z.string().trim().max(300).nullable(),
      contactPhone: z.string().trim().max(20).nullable(),
      currency: z.enum(["KES", "UGX", "TZS", "RWF", "GHS", "NGN", "ZAR", "USD"]),
    }),
  )
  .handler(async ({ data }) => {
    const { org, db } = await requireMember(["owner"]);
    await db`update orgs set name = ${data.name}, industry = ${data.industry}, welcome = ${data.welcome}, contact_phone = ${data.contactPhone}, currency = ${data.currency} where id = ${org.id}`;
    return { ok: true };
  });

export const getResellerEarnings = createServerFn({ method: "GET" })
  .validator(z.object({ membershipId: id }))
  .handler(async ({ data }) => {
    const { org, db } = await requireManager();
    const [m] = await db`select 1 from memberships where id = ${data.membershipId} and org_id = ${org.id}`;
    if (!m) throw new Error("Not found.");
    return earningsFor(db, data.membershipId);
  });
