import { randomBytes } from "node:crypto";
import { sql } from "./db.server";
import { readSession, type SessionUser } from "./auth.server";

export type Role = "owner" | "manager" | "reseller";

export type OrgRow = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  currency: string;
  plan_id: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  trial_ends_at: Date | null;
  current_period_end: Date | null;
  join_code: string;
  default_commission: string;
  welcome: string | null;
  contact_phone: string | null;
  created_at: Date;
};

export type MemberRow = {
  id: string;
  org_id: string;
  user_id: string;
  role: Role;
  status: "active" | "pending" | "suspended";
  code: string;
  tier_id: string | null;
  commission_override: string | null;
  region: string | null;
  payout_method: "mpesa" | "bank" | null;
  payout_details: string | null;
};

/** Is the company's subscription in good standing right now? */
export function access(org: Pick<OrgRow, "status" | "trial_ends_at" | "current_period_end">) {
  const now = Date.now();
  if (org.status === "active" && org.current_period_end && org.current_period_end.getTime() > now)
    return { open: true, reason: "active" as const, until: org.current_period_end };
  if (org.status === "trialing" && org.trial_ends_at && org.trial_ends_at.getTime() > now)
    return { open: true, reason: "trial" as const, until: org.trial_ends_at };
  return { open: false, reason: org.status === "trialing" ? ("trial_over" as const) : ("lapsed" as const), until: org.current_period_end ?? org.trial_ends_at };
}

export async function requireSession(): Promise<SessionUser> {
  const s = await readSession();
  if (!s) throw new Error("You're signed out. Sign in and try again.");
  return s;
}

/** The signed-in user's membership in their active company, checked against allowed roles. */
export async function requireMember(roles: Role[] = ["owner", "manager", "reseller"], opts: { allowPending?: boolean } = {}) {
  const s = await requireSession();
  if (!s.orgId) throw new Error("Pick a company first.");
  const db = await sql();
  const [m] = await db<MemberRow[]>`select * from memberships where org_id = ${s.orgId} and user_id = ${s.user.id}`;
  if (!m) throw new Error("You're not part of this company.");
  if (m.status === "suspended") throw new Error("Your access to this company is on hold. Contact the company.");
  if (m.status === "pending" && !opts.allowPending) throw new Error("The company hasn't approved your account yet.");
  if (!roles.includes(m.role)) throw new Error("You don't have permission to do that.");
  const [org] = await db<OrgRow[]>`select * from orgs where id = ${s.orgId}`;
  return { s, m, org, db };
}

export async function requireManager() {
  return requireMember(["owner", "manager"]);
}

export function assertOpen(org: OrgRow) {
  const a = access(org);
  if (!a.open)
    throw new Error(
      a.reason === "trial_over"
        ? "The free trial has ended. Choose a plan on the Billing page to keep selling."
        : "The subscription has lapsed. Renew on the Billing page to keep selling.",
    );
}

export async function requirePlatformAdmin() {
  const s = await requireSession();
  if (!s.user.is_platform_admin) throw new Error("Only Anchor staff can do that.");
  return { s, db: await sql() };
}

/* ---------- small helpers ---------- */

export const num = (v: string | number | null | undefined) => Number(v ?? 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function code(len = 6) {
  const b = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += CODE[b[i] % CODE.length];
  return s;
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "company"
  );
}

export function orderRef() {
  return `A${Date.now().toString(36).toUpperCase().slice(-6)}${code(2)}`;
}

/** Commission rate (%) for a reseller on a product: product → reseller override → tier → company default. */
export function rateFor(
  product: { commission_rate: string | null },
  member: { commission_override: string | null; tier_rate: string | null },
  org: { default_commission: string },
) {
  if (product.commission_rate != null) return num(product.commission_rate);
  if (member.commission_override != null) return num(member.commission_override);
  if (member.tier_rate != null) return num(member.tier_rate);
  return num(org.default_commission);
}

/** Earnings for a reseller: commission on fulfilled orders, minus payouts requested or paid. */
export async function earningsFor(db: Awaited<ReturnType<typeof sql>>, membershipId: string) {
  const [e] = await db<{ earned: string; pending: string }[]>`
    select coalesce(sum(commission) filter (where status = 'fulfilled'), 0) as earned,
           coalesce(sum(commission) filter (where status in ('new','confirmed')), 0) as pending
    from orders where reseller_id = ${membershipId}`;
  const [p] = await db<{ committed: string; paid: string }[]>`
    select coalesce(sum(amount) filter (where status in ('requested','paid')), 0) as committed,
           coalesce(sum(amount) filter (where status = 'paid'), 0) as paid
    from payouts where membership_id = ${membershipId}`;
  return {
    earned: round2(num(e.earned)),
    pending: round2(num(e.pending)),
    paid: round2(num(p.paid)),
    available: round2(Math.max(0, num(e.earned) - num(p.committed))),
  };
}

export async function uniqueSlug(db: Awaited<ReturnType<typeof sql>>, base: string) {
  const root = slugify(base);
  for (let i = 0; i < 30; i++) {
    const s = i === 0 ? root : `${root}-${i + 1}`;
    const [hit] = await db`select 1 from orgs where slug = ${s}`;
    if (!hit) return s;
  }
  return `${root}-${code(4).toLowerCase()}`;
}

export async function uniqueMemberCode(db: Awaited<ReturnType<typeof sql>>, orgId: string, name: string) {
  const base = name.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "R";
  for (let i = 0; i < 30; i++) {
    const c = `${base}${code(3)}`;
    const [hit] = await db`select 1 from memberships where org_id = ${orgId} and code = ${c}`;
    if (!hit) return c;
  }
  return code(8);
}
