import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/server/db.server";
import {
  checkThrottle,
  clearFailures,
  endSession,
  hashPassword,
  noteFailure,
  readSession,
  setSessionOrg,
  startSession,
  verifyPassword,
} from "@/server/auth.server";
import { access, code, requireSession, uniqueMemberCode, uniqueSlug, type MemberRow, type OrgRow } from "@/server/ctx.server";

const TRIAL_DAYS = 14;
const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(200);

/** Everything the UI needs to know about who is signed in. */
export const getViewer = createServerFn({ method: "GET" }).handler(async () => {
  const s = await readSession();
  if (!s) return null;
  const db = await sql();
  const memberships = await db<{ id: string; org_id: string; role: string; status: string; org_name: string; org_slug: string }[]>`
    select m.id, m.org_id, m.role, m.status, o.name as org_name, o.slug as org_slug
    from memberships m join orgs o on o.id = m.org_id
    where m.user_id = ${s.user.id} order by m.created_at`;

  let orgId = s.orgId;
  if ((!orgId || !memberships.some((m) => m.org_id === orgId)) && memberships.length > 0) {
    orgId = memberships[0].org_id;
    await setSessionOrg(s.sessionId, orgId);
  }
  let active: null | {
    org: Omit<OrgRow, "trial_ends_at" | "current_period_end" | "created_at"> & { trial_ends_at: string | null; current_period_end: string | null; plan_name: string };
    member: MemberRow;
    access: { open: boolean; reason: string; until: string | null; daysLeft: number | null };
  } = null;
  if (orgId) {
    const [org] = await db<(OrgRow & { plan_name: string })[]>`select o.*, p.name as plan_name from orgs o join plans p on p.id = o.plan_id where o.id = ${orgId}`;
    const [member] = await db<MemberRow[]>`select * from memberships where org_id = ${orgId} and user_id = ${s.user.id}`;
    const a = access(org);
    const { created_at: _created, ...rest } = org;
    active = {
      org: {
        ...rest,
        trial_ends_at: org.trial_ends_at?.toISOString() ?? null,
        current_period_end: org.current_period_end?.toISOString() ?? null,
      },
      member,
      access: {
        open: a.open,
        reason: a.reason,
        until: a.until?.toISOString() ?? null,
        daysLeft: a.until ? Math.max(0, Math.ceil((a.until.getTime() - Date.now()) / 864e5)) : null,
      },
    };
  }
  return { user: s.user, memberships, active };
});

/** A company signs up: creates the owner account, the company, and starts the free trial. */
export const signUpCompany = createServerFn({ method: "POST" })
  .validator(
    z.object({
      company: z.string().trim().min(2, "Enter your company name.").max(80),
      industry: z.string().trim().min(2).max(60),
      name: z.string().trim().min(2, "Enter your name.").max(80),
      email,
      phone: z.string().trim().min(9, "Enter a phone number.").max(20),
      password,
      plan: z.enum(["starter", "growth", "scale"]).default("growth"),
    }),
  )
  .handler(async ({ data }) => {
    const db = await sql();
    const [exists] = await db`select 1 from users where email = ${data.email}`;
    if (exists) throw new Error("An account with this email already exists. Sign in instead.");
    const hash = await hashPassword(data.password);
    const slug = await uniqueSlug(db, data.company);
    const result = await db.begin(async (tx) => {
      const [u] = await tx<{ id: string }[]>`insert into users (email, name, phone, password_hash) values (${data.email}, ${data.name}, ${data.phone}, ${hash}) returning id`;
      const [o] = await tx<{ id: string }[]>`
        insert into orgs (name, slug, industry, plan_id, status, trial_ends_at, join_code, contact_phone)
        values (${data.company}, ${slug}, ${data.industry}, ${data.plan}, 'trialing', now() + ${`${TRIAL_DAYS} days`}::interval, ${code(8)}, ${data.phone})
        returning id`;
      await tx`insert into tiers (org_id, name, commission_rate, sort) values (${o.id}, 'Bronze', 8, 1), (${o.id}, 'Silver', 10, 2), (${o.id}, 'Gold', 12.5, 3)`;
      await tx`insert into memberships (org_id, user_id, role, code) values (${o.id}, ${u.id}, 'owner', ${"OWNER"})`;
      return { userId: u.id, orgId: o.id };
    });
    await startSession(result.userId, result.orgId);
    return { ok: true };
  });

export const signIn = createServerFn({ method: "POST" })
  .validator(z.object({ email, password: z.string().min(1) }))
  .handler(async ({ data }) => {
    checkThrottle(data.email);
    const db = await sql();
    const [u] = await db<{ id: string; password_hash: string }[]>`select id, password_hash from users where email = ${data.email}`;
    if (!u || !(await verifyPassword(data.password, u.password_hash))) {
      noteFailure(data.email);
      throw new Error("That email and password don't match. Check both and try again.");
    }
    clearFailures(data.email);
    const [m] = await db<{ org_id: string }[]>`select org_id from memberships where user_id = ${u.id} order by created_at limit 1`;
    await startSession(u.id, m?.org_id ?? null);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await endSession();
  return { ok: true };
});

/** Public: what a join link points to. */
export const getJoinInfo = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().trim().min(4).max(20) }))
  .handler(async ({ data }) => {
    const db = await sql();
    const [o] = await db<{ name: string; industry: string; welcome: string | null }[]>`select name, industry, welcome from orgs where upper(join_code) = upper(${data.code})`;
    return o ?? null;
  });

/** A reseller joins a company with its join code. New accounts are created; signed-in users are added. */
export const joinCompany = createServerFn({ method: "POST" })
  .validator(
    z.object({
      code: z.string().trim().min(4).max(20),
      name: z.string().trim().min(2).max(80).optional(),
      email: email.optional(),
      phone: z.string().trim().min(9).max(20).optional(),
      password: password.optional(),
      region: z.string().trim().max(60).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = await sql();
    const [org] = await db<{ id: string }[]>`select id from orgs where upper(join_code) = upper(${data.code})`;
    if (!org) throw new Error("That join link isn't valid. Ask the company for a new one.");

    let s = await readSession();
    let userId = s?.user.id;
    let name = s?.user.name;
    if (!userId) {
      if (!data.name || !data.email || !data.phone || !data.password) throw new Error("Fill in every field.");
      const [exists] = await db`select 1 from users where email = ${data.email}`;
      if (exists) throw new Error("This email already has an Anchor account. Sign in first, then open the join link again.");
      const [u] = await db<{ id: string }[]>`
        insert into users (email, name, phone, password_hash) values (${data.email}, ${data.name}, ${data.phone}, ${await hashPassword(data.password)}) returning id`;
      userId = u.id;
      name = data.name;
    }
    const [already] = await db`select 1 from memberships where org_id = ${org.id} and user_id = ${userId}`;
    if (!already) {
      const [tier] = await db<{ id: string }[]>`select id from tiers where org_id = ${org.id} order by sort limit 1`;
      await db`
        insert into memberships (org_id, user_id, role, status, code, tier_id, region)
        values (${org.id}, ${userId}, 'reseller', 'pending', ${await uniqueMemberCode(db, org.id, name ?? "R")}, ${tier?.id ?? null}, ${data.region ?? null})`;
    }
    if (s) await setSessionOrg(s.sessionId, org.id);
    else await startSession(userId!, org.id);
    return { ok: true };
  });

export const switchCompany = createServerFn({ method: "POST" })
  .validator(z.object({ orgId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const db = await sql();
    const [m] = await db`select 1 from memberships where org_id = ${data.orgId} and user_id = ${s.user.id}`;
    if (!m) throw new Error("You're not part of that company.");
    await setSessionOrg(s.sessionId, data.orgId);
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().trim().min(2).max(80), phone: z.string().trim().min(9).max(20) }))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const db = await sql();
    await db`update users set name = ${data.name}, phone = ${data.phone} where id = ${s.user.id}`;
    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .validator(z.object({ current: z.string().min(1), next: password }))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const db = await sql();
    const [u] = await db<{ password_hash: string }[]>`select password_hash from users where id = ${s.user.id}`;
    if (!(await verifyPassword(data.current, u.password_hash))) throw new Error("Your current password isn't right.");
    await db`update users set password_hash = ${await hashPassword(data.next)} where id = ${s.user.id}`;
    await db`delete from sessions where user_id = ${s.user.id} and id <> ${s.sessionId}`;
    return { ok: true };
  });
