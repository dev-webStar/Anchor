/*
  M-Pesa Daraja (Safaricom) — Lipa Na M-Pesa Online (STK push).

  Environment:
    MPESA_ENV              sandbox | production
    MPESA_CONSUMER_KEY     from the Daraja app
    MPESA_CONSUMER_SECRET
    MPESA_SHORTCODE        Paybill or Till number (sandbox: 174379)
    MPESA_PASSKEY          Lipa Na M-Pesa Online passkey
    MPESA_TRANSACTION_TYPE CustomerPayBillOnline (Paybill, default) | CustomerBuyGoodsOnline (Till)
    MPESA_CALLBACK_SECRET  random string; Safaricom calls /api/mpesa/callback?secret=<this>
    PUBLIC_URL             your site's public https address, e.g. https://anchor.co.ke
*/

export function mpesaConfigured() {
  return !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET && process.env.MPESA_SHORTCODE && process.env.MPESA_PASSKEY && process.env.PUBLIC_URL);
}

const base = () => (process.env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

let cached: { token: string; until: number } | null = null;
async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
  const r = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${auth}` } });
  if (!r.ok) throw new Error("M-Pesa didn't accept our credentials. Check the Daraja keys.");
  const j = (await r.json()) as { access_token: string; expires_in: string };
  cached = { token: j.access_token, until: Date.now() + (Number(j.expires_in) - 60) * 1000 };
  return j.access_token;
}

/** 0712345678 / +254712345678 / 712345678 → 254712345678 */
export function toMsisdn(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0")) d = "254" + d.slice(1);
  if (d.length === 9) d = "254" + d;
  if (!/^254(7|1)\d{8}$/.test(d)) throw new Error("Enter a Safaricom number, like 0712 345 678.");
  return d;
}

export async function stkPush(opts: { phone: string; amount: number; accountRef: string; description: string }) {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const password = Buffer.from(`${shortcode}${process.env.MPESA_PASSKEY}${ts}`).toString("base64");
  const callback = `${process.env.PUBLIC_URL!.replace(/\/$/, "")}/api/mpesa/callback?secret=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET ?? "")}`;
  const r = await fetch(`${base()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE ?? "CustomerPayBillOnline",
      Amount: Math.round(opts.amount),
      PartyA: opts.phone,
      PartyB: shortcode,
      PhoneNumber: opts.phone,
      CallBackURL: callback,
      AccountReference: opts.accountRef.slice(0, 12),
      TransactionDesc: opts.description.slice(0, 13),
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { CheckoutRequestID?: string; ResponseCode?: string; errorMessage?: string; CustomerMessage?: string };
  if (!r.ok || j.ResponseCode !== "0" || !j.CheckoutRequestID) throw new Error(j.errorMessage || "M-Pesa couldn't start the payment. Try again.");
  return { checkoutRequestId: j.CheckoutRequestID, message: j.CustomerMessage ?? "Check your phone and enter your M-Pesa PIN." };
}

export type StkCallback = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: { Item: { Name: string; Value?: string | number }[] };
    };
  };
};
