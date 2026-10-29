import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/server/db.server";
import { access, num, requireMember, requirePlatformAdmin } from "@/server/ctx.server";
import { billingRef, confirmSubscriptionPayment, payTo, priceFor } from "@/server/billing.server";
import { mpesaConfigured, stkPush, toMsisdn } from "@/server/mpesa.server";

const planId = z.enum(["starter", "growth", "scale"]);
const months = z.union([z.literal(1), z.literal(12)]);

/** Public: the plans, for the home page and sign-up. */
export const getPlans = createServerFn({ method: "GET" }).handler(async () => {
  const db = await sql();
  const rows = await db<{ id: string; name: string; price_monthly: number; reseller_limit: number | null; product_limit: number | null; staff_limit: number | null; blurb: string; features: string[] }[]>`
    select id, name, price_monthly, reseller_limit, product_limit, staff_limit, blurb, features from plans order by sort`;
  return rows;
});

export const getBilling = createServerFn({ method: "GET" }).handler(async () => {
  const { org, db } = await requireMember(["owner", "manager"]);
  const plans = await db<{ id: string; name: string; price_monthly: number; reseller_limit: number | null; product_limit: number | null; blurb: string; features: string[] }[]>`
    select id, name, price_monthly, reseller_limit, product_limit, blurb, features from plans order by sort`;
  const payments = await db<{ id: string; plan_id: string; months: number; amount: number; method: string; status: string; reference: string | null; created_at: Date; confirmed_at: Date | null }[]>`
    select id, plan_id, months, amount, method, status, reference, created_at, confirmed_at
    from subscription_payments where org_id = ${org.id} order by created_at desc limit 50`;
  const [usage] = await db<{ resellers: string; products: string }[]>`
    select (select count(*) from memberships where org_id = ${org.id} and role = 'reseller' and status = 'active') as resellers,
           (select count(*) from products where org_id = ${org.id}) as products`;
  const a = access(org);
  return {
    org: { name: org.name, plan_id: org.plan_id, status: org.status, trial_ends_at: org.trial_ends_at, current_period_end: org.current_period_end },
    access: { open: a.open, reason: a.reason, until: a.until },
    plans,
    payments,
    usage: { resellers: num(usage.resellers), products: num(usage.products) },
    stk: mpesaConfigured(),
    payTo: payTo(),
    accountRef: billingRef(org.slug),
  };
});

export const startMpesaPayment = createServerFn({ method: "POST" })
  .validator(z.object({ plan: planId, months, phone: z.string().trim().min(9).max(16) }))
  .handler(async ({ data }) => {
    const { org, db, s } = await requireMember(["owner"]);
    if (!mpesaConfigured()) throw new Error("M-Pesa prompts aren't set up yet. Pay with the Paybill details instead.");
    const [plan] = await db<{ price_monthly: number; name: string }[]>`select price_monthly, name from plans where id = ${data.plan}`;
    const amount = priceFor(plan.price_monthly, data.months);
    const phone = toMsisdn(data.phone);
    const stk = await stkPush({ phone, amount, accountRef: billingRef(org.slug), description: `Anchor ${plan.name}` });
    const [p] = await db<{ id: string }[]>`
      insert into subscription_payments (org_id, plan_id, months, amount, method, phone, checkout_request_id, submitted_by)
      values (${org.id}, ${data.plan}, ${data.months}, ${amount}, 'mpesa_stk', ${phone}, ${stk.checkoutRequestId}, ${s.user.id}) returning id`;
    return { paymentId: p.id, message: stk.message };
  });

export const getPaymentStatus = createServerFn({ method: "GET" })
  .validator(z.object({ paymentId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { org, db } = await requireMember(["owner", "manager"]);
    const [p] = await db<{ status: string; reference: string | null }[]>`select status, reference from subscription_payments where id = ${data.paymentId} and org_id = ${org.id}`;
    return p ?? null;
  });

/** Paid by M-Pesa Paybill/Till or bank transfer: record the reference for Anchor to check. */
export const submitManualPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      plan: planId,
      months,
      method: z.enum(["mpesa_manual", "bank"]),
      reference: z.string().trim().min(6, "Enter the M-Pesa code or bank reference.").max(40),
    }),
  )
  .handler(async ({ data }) => {
    const { org, db, s } = await requireMember(["owner"]);
    const ref = data.reference.toUpperCase().replace(/\s+/g, "");
    const [dup] = await db`select 1 from subscription_payments where upper(reference) = ${ref} and status in ('pending','confirmed')`;
    if (dup) throw new Error("That reference has already been submitted.");
    const [plan] = await db<{ price_monthly: number }[]>`select price_monthly from plans where id = ${data.plan}`;
    await db`
      insert into subscription_payments (org_id, plan_id, months, amount, method, reference, submitted_by)
      values (${org.id}, ${data.plan}, ${data.months}, ${priceFor(plan.price_monthly, data.months)}, ${data.method}, ${ref}, ${s.user.id})`;
    return { ok: true };
  });

/* ======================= Anchor staff (platform) ======================= */

export const platformOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await requirePlatformAdmin();
  const orgs = await db<{ id: string; name: string; slug: string; industry: string; plan_id: string; status: string; trial_ends_at: Date | null; current_period_end: Date | null; created_at: Date; owner: string | null; owner_email: string | null; resellers: string; sales30: string }[]>`
    select o.id, o.name, o.slug, o.industry, o.plan_id, o.status, o.trial_ends_at, o.current_period_end, o.created_at,
      (select u.name from memberships m join users u on u.id = m.user_id where m.org_id = o.id and m.role = 'owner' limit 1) as owner,
      (select u.email from memberships m join users u on u.id = m.user_id where m.org_id = o.id and m.role = 'owner' limit 1) as owner_email,
      (select count(*) from memberships m where m.org_id = o.id and m.role = 'reseller' and m.status = 'active') as resellers,
      coalesce((select sum(total) from orders r where r.org_id = o.id and r.status <> 'cancelled' and r.created_at > now() - interval '30 days'), 0) as sales30
    from orgs o order by o.created_at desc`;
  const payments = await db<{ id: string; org_name: string; plan_id: string; months: number; amount: number; method: string; status: string; reference: string | null; phone: string | null; created_at: Date }[]>`
    select p.id, o.name as org_name, p.plan_id, p.months, p.amount, p.method, p.status, p.reference, p.phone, p.created_at
    from subscription_payments p join orgs o on o.id = p.org_id order by (p.status = 'pending') desc, p.created_at desc limit 200`;
  const [mrr] = await db<{ mrr: string }[]>`
    select coalesce(sum(pl.price_monthly), 0) as mrr from orgs o join plans pl on pl.id = o.plan_id
    where o.status = 'active' and o.current_period_end > now()`;
  return {
    orgs: orgs.map((o) => ({ ...o, resellers: num(o.resellers), sales30: num(o.sales30), access: access(o as never) })),
    payments,
    mrr: num(mrr.mrr),
  };
});

export const platformSettlePayment = createServerFn({ method: "POST" })
  .validator(z.object({ paymentId: z.string().uuid(), action: z.enum(["confirm", "reject"]) }))
  .handler(async ({ data }) => {
    const { db } = await requirePlatformAdmin();
    if (data.action === "confirm") {
      const ok = await confirmSubscriptionPayment(data.paymentId);
      if (!ok) throw new Error("This payment was already handled.");
    } else {
      await db`update subscription_payments set status = 'rejected' where id = ${data.paymentId} and status = 'pending'`;
    }
    return { ok: true };
  });

export const platformExtendTrial = createServerFn({ method: "POST" })
  .validator(z.object({ orgId: z.string().uuid(), days: z.number().int().min(1).max(90) }))
  .handler(async ({ data }) => {
    const { db } = await requirePlatformAdmin();
    await db`update orgs set status = 'trialing', trial_ends_at = greatest(coalesce(trial_ends_at, now()), now()) + ${`${data.days} days`}::interval where id = ${data.orgId}`;
    return { ok: true };
  });
