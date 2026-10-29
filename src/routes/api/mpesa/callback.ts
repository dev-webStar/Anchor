import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import type { StkCallback } from "@/server/mpesa.server";

/*
  Safaricom posts the STK push result here. We only act on CheckoutRequestIDs we created,
  and only when the shared secret in the URL matches MPESA_CALLBACK_SECRET.
*/
const ok = () => new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { headers: { "content-type": "application/json" } });

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const Route = createFileRoute("/api/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.MPESA_CALLBACK_SECRET ?? "";
        const given = new URL(request.url).searchParams.get("secret") ?? "";
        if (!expected || !sameSecret(given, expected)) return new Response("forbidden", { status: 403 });

        const body = (await request.json().catch(() => null)) as StkCallback | null;
        const cb = body?.Body?.stkCallback;
        if (!cb?.CheckoutRequestID) return ok();

        const { sql } = await import("@/server/db.server");
        const { confirmSubscriptionPayment } = await import("@/server/billing.server");
        const db = await sql();
        const [p] = await db<{ id: string; amount: number }[]>`
          select id, amount from subscription_payments where checkout_request_id = ${cb.CheckoutRequestID} and status = 'pending'`;
        if (!p) return ok();

        if (cb.ResultCode !== 0) {
          await db`update subscription_payments set status = 'failed', raw = ${db.json(body as never)} where id = ${p.id}`;
          return ok();
        }
        const items = Object.fromEntries((cb.CallbackMetadata?.Item ?? []).map((i) => [i.Name, i.Value]));
        if (Number(items.Amount) < p.amount) {
          await db`update subscription_payments set status = 'failed', raw = ${db.json(body as never)} where id = ${p.id}`;
          return ok();
        }
        await confirmSubscriptionPayment(p.id, { reference: String(items.MpesaReceiptNumber ?? ""), raw: body });
        return ok();
      },
    },
  },
});
