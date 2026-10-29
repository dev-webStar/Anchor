import { sql } from "./db.server";

export const ANNUAL_MONTHS_CHARGED = 10; // pay 10 months, get 12

export function priceFor(monthly: number, months: 1 | 12) {
  return months === 12 ? monthly * ANNUAL_MONTHS_CHARGED : monthly;
}

/** Where companies send manual payments. Set these in the server environment. */
export function payTo() {
  return {
    paybill: process.env.ANCHOR_MPESA_PAYBILL || null,
    till: process.env.ANCHOR_MPESA_TILL || null,
    bank: process.env.ANCHOR_BANK_ACCOUNT_NUMBER
      ? {
          bank: process.env.ANCHOR_BANK_NAME ?? "",
          branch: process.env.ANCHOR_BANK_BRANCH ?? "",
          accountName: process.env.ANCHOR_BANK_ACCOUNT_NAME ?? "",
          accountNumber: process.env.ANCHOR_BANK_ACCOUNT_NUMBER,
          swift: process.env.ANCHOR_BANK_SWIFT ?? "",
        }
      : null,
  };
}

/** The account number a company uses when paying, so payments can be matched. */
export function billingRef(slug: string) {
  return slug.replace(/-/g, "").toUpperCase().slice(0, 12);
}

/** Mark a payment confirmed and extend the company's paid period. Safe to call twice. */
export async function confirmSubscriptionPayment(paymentId: string, extra: { reference?: string | null; raw?: unknown } = {}) {
  const db = await sql();
  return db.begin(async (tx) => {
    const [p] = await tx<{ id: string; org_id: string; plan_id: string; months: number }[]>`
      update subscription_payments set status = 'confirmed', confirmed_at = now(),
        reference = coalesce(${extra.reference ?? null}, reference),
        raw = coalesce(${extra.raw ? tx.json(extra.raw as never) : null}, raw)
      where id = ${paymentId} and status = 'pending' returning id, org_id, plan_id, months`;
    if (!p) return false;
    await tx`
      update orgs set plan_id = ${p.plan_id}, status = 'active',
        current_period_end = greatest(coalesce(current_period_end, now()), now()) + ${`${p.months} months`}::interval
      where id = ${p.org_id}`;
    return true;
  });
}
