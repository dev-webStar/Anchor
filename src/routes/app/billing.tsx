import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getBilling, getPaymentStatus, startMpesaPayment, submitManualPayment } from "@/lib/api/billing.functions";
import { amount, shortDate } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Field, Input, Loading, PageTitle, Panel, SectionHead, Segmented, Spinner, Status, Table, Td, Th } from "@/components/kit";
import { CopyButton } from "@/components/bits";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/billing")({ component: Billing });

type Method = "stk" | "paybill" | "bank";

function Billing() {
  const { isOwner, viewer } = useActive();
  const fn = useServerFn(getBilling);
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => fn() });
  const [plan, setPlan] = useState<"starter" | "growth" | "scale">("growth");
  const [months, setMonths] = useState<1 | 12>(1);
  const [method, setMethod] = useState<Method>("paybill");

  useEffect(() => {
    if (data) {
      setPlan(data.org.plan_id as typeof plan);
      setMethod(data.stk ? "stk" : data.payTo.paybill || data.payTo.till ? "paybill" : "bank");
    }
  }, [data?.org.plan_id, data?.stk]);

  if (isLoading || !data) return <Loading />;
  const current = data.plans.find((p) => p.id === data.org.plan_id)!;
  const chosen = data.plans.find((p) => p.id === plan)!;
  const price = months === 12 ? chosen.price_monthly * 10 : chosen.price_monthly;

  const stateLine =
    data.access.reason === "trial"
      ? `Free trial until ${shortDate(data.access.until!)}`
      : data.access.reason === "active"
        ? `Paid until ${shortDate(data.access.until!)}`
        : data.access.reason === "trial_over"
          ? "Free trial ended"
          : "Subscription lapsed";

  return (
    <>
      <PageTitle title="Billing" jp="請求">Your Anchor subscription. Pay by M-Pesa or bank transfer; your plan updates as soon as payment is confirmed.</PageTitle>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <Panel className="p-5 md:p-6">
          <p className="text-[13px] font-bold text-ink-2">Current plan</p>
          <p className="mt-1 font-mincho text-[30px] font-extrabold">{current.name}</p>
          <p className={cn("mt-1 text-[15px] font-bold", data.access.open ? "text-ink" : "text-shu")}>{stateLine}</p>
          <p className="num mt-4 text-[15px] text-ink-2">KES {amount(current.price_monthly)} a month</p>
        </Panel>
        <Panel className="space-y-4 p-5 md:p-6">
          <Usage label="Active resellers" used={data.usage.resellers} limit={current.reseller_limit} />
          <Usage label="Products" used={data.usage.products} limit={current.product_limit} />
        </Panel>
      </div>

      {isOwner ? (
        <section className="mt-12">
          <SectionHead title={data.access.open ? "Renew or change plan" : "Choose a plan to continue"} jp="プラン" right={<Segmented value={String(months)} onChange={(v) => setMonths(Number(v) as 1 | 12)} options={[{ value: "1", label: "1 month" }, { value: "12", label: "12 months · 2 free" }]} />} />
          <div className="grid gap-3 md:grid-cols-3">
            {data.plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlan(p.id as typeof plan)}
                className={cn("rounded-[14px] border-2 bg-paper p-5 text-left transition-colors", plan === p.id ? "border-ink" : "border-rule hover:border-ink-3")}
              >
                <span className="flex items-center justify-between">
                  <span className="text-[18px] font-black">{p.name}</span>
                  <span className={cn("grid size-5 place-items-center rounded-full border-2", plan === p.id ? "border-ink" : "border-rule-2")}>{plan === p.id && <span className="size-2.5 rounded-full bg-ink" />}</span>
                </span>
                <span className="num mt-2 block text-[24px] font-black">KES {amount(months === 12 ? p.price_monthly * 10 : p.price_monthly)}</span>
                <span className="block text-[13px] text-ink-2">{p.reseller_limit ? `Up to ${p.reseller_limit} resellers` : "Unlimited resellers"}</span>
              </button>
            ))}
          </div>

          <Panel className="mt-6">
            <div className="border-b border-rule px-5 py-4">
              <p className="text-[15px]">
                Paying <b className="num">KES {amount(price)}</b> for <b>{chosen.name}</b>, {months === 12 ? "12 months" : "1 month"}.
              </p>
            </div>
            <div className="p-5">
              <Segmented<Method>
                value={method}
                onChange={setMethod}
                className="mb-5"
                options={[
                  ...(data.stk ? [{ value: "stk" as Method, label: "M-Pesa prompt" }] : []),
                  { value: "paybill", label: "M-Pesa Paybill" },
                  { value: "bank", label: "Bank transfer" },
                ]}
              />
              {method === "stk" && <StkForm plan={plan} months={months} defaultPhone={viewer?.user.phone ?? ""} />}
              {method === "paybill" && <ManualForm kind="mpesa_manual" plan={plan} months={months} price={price} payTo={data.payTo} accountRef={data.accountRef} />}
              {method === "bank" && <ManualForm kind="bank" plan={plan} months={months} price={price} payTo={data.payTo} accountRef={data.accountRef} />}
            </div>
          </Panel>
        </section>
      ) : (
        <p className="mt-10 text-ink-2">Only the company owner can pay for the subscription.</p>
      )}

      <section className="mt-12">
        <SectionHead title="Payment history" jp="履歴" />
        {data.payments.length === 0 ? (
          <p className="border-y border-rule py-6 text-ink-2">No payments yet.</p>
        ) : (
          <Panel>
            <Table>
              <thead><tr><Th>Date</Th><Th>Plan</Th><Th>Method</Th><Th>Reference</Th><Th className="text-right">Amount</Th><Th>Status</Th></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="num whitespace-nowrap">{format(new Date(p.created_at), "d MMM yyyy")}</Td>
                    <Td className="capitalize">{p.plan_id} · {p.months === 12 ? "12 months" : "1 month"}</Td>
                    <Td>{p.method === "mpesa_stk" ? "M-Pesa prompt" : p.method === "mpesa_manual" ? "M-Pesa Paybill" : "Bank"}</Td>
                    <Td className="num">{p.reference ?? "—"}</Td>
                    <Td className="num text-right font-bold">KES {amount(p.amount)}</Td>
                    <Td><Status status={p.status === "confirmed" ? "confirmed_payment" : p.status === "pending" ? "pending" : p.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )}
      </section>
    </>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 12;
  return (
    <div>
      <p className="flex justify-between text-[14px]">
        <span className="font-bold">{label}</span>
        <span className="num text-ink-2">{used} of {limit ?? "unlimited"}</span>
      </p>
      <span className="mt-1.5 block h-2.5 rounded-full bg-stone-2">
        <span className={cn("block h-full rounded-full", limit && used >= limit ? "bg-shu" : "bg-ai")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function StkForm({ plan, months, defaultPhone }: { plan: string; months: 1 | 12; defaultPhone: string }) {
  const start = useServerFn(startMpesaPayment);
  const status = useServerFn(getPaymentStatus);
  const qc = useQueryClient();
  const [phone, setPhone] = useState(defaultPhone);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const s = await status({ data: { paymentId: waiting } }).catch(() => null);
      if (s?.status === "confirmed") {
        clearInterval(t);
        setWaiting(null);
        toast.success("Payment received. Your plan is active.");
        qc.invalidateQueries();
      } else if (s?.status === "failed" || tries > 40) {
        clearInterval(t);
        setWaiting(null);
        toast.error(s?.status === "failed" ? "The payment didn't go through. Try again." : "We didn't hear back from M-Pesa. If you paid, it will show up shortly.");
        qc.invalidateQueries({ queryKey: ["billing"] });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [waiting]);

  if (waiting)
    return (
      <div className="flex items-center gap-4 rounded-[12px] border border-rule bg-stone/50 p-5">
        <Spinner />
        <div>
          <p className="font-bold">Check your phone</p>
          <p className="text-[15px] text-ink-2">Enter your M-Pesa PIN on the prompt. This page updates by itself.</p>
        </div>
      </div>
    );

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await start({ data: { plan: plan as "growth", months, phone } });
          setWaiting(r.paymentId);
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Safaricom number" htmlFor="sp" className="min-w-[220px] flex-1" hint="We'll send an M-Pesa prompt to this phone.">
        <Input id="sp" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="num" />
      </Field>
      <Button type="submit" variant="yamabuki" loading={busy} className="mb-[26px]">Send prompt</Button>
    </form>
  );
}

function ManualForm({
  kind,
  plan,
  months,
  price,
  payTo,
  accountRef,
}: {
  kind: "mpesa_manual" | "bank";
  plan: string;
  months: 1 | 12;
  price: number;
  payTo: Awaited<ReturnType<typeof getBilling>>["payTo"];
  accountRef: string;
}) {
  const submit = useServerFn(submitManualPayment);
  const qc = useQueryClient();
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  const details: [string, string | null][] =
    kind === "mpesa_manual"
      ? payTo.paybill
        ? [["Paybill number", payTo.paybill], ["Account number", accountRef], ["Amount", `KES ${amount(price)}`]]
        : payTo.till
          ? [["Till number", payTo.till], ["Amount", `KES ${amount(price)}`]]
          : [["Paybill number", null]]
      : payTo.bank
        ? [["Bank", `${payTo.bank.bank}${payTo.bank.branch ? `, ${payTo.bank.branch}` : ""}`], ["Account name", payTo.bank.accountName], ["Account number", payTo.bank.accountNumber], ...(payTo.bank.swift ? ([["SWIFT", payTo.bank.swift]] as [string, string][]) : []), ["Reference", accountRef], ["Amount", `KES ${amount(price)}`]]
        : [["Bank account", null]];
  const missing = details.some(([, v]) => v == null);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <p className="mb-2 text-[13px] font-bold text-ink-2">{kind === "bank" ? "Transfer to" : "Pay with M-Pesa"}</p>
        {missing ? (
          <p className="rounded-[10px] border border-rule bg-stone/50 p-4 text-[15px] text-ink-2">
            Payment details haven't been set up on this server yet. Anchor staff add them in the server settings.
          </p>
        ) : (
          <dl className="divide-y divide-rule rounded-[10px] border border-rule">
            {details.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[15px]">
                <dt className="text-ink-2">{k}</dt>
                <dd className="num flex items-center gap-2 font-bold">
                  {v}
                  {k !== "Amount" && k !== "Bank" && <CopyButton value={v!} label={`Copy ${k}`} small />}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await submit({ data: { plan: plan as "growth", months, method: kind, reference: ref } });
            toast.success("Thanks. We'll confirm your payment and switch on your plan, usually within a few hours.");
            setRef("");
            qc.invalidateQueries({ queryKey: ["billing"] });
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
        className="space-y-4"
      >
        <Field label={kind === "bank" ? "Bank reference" : "M-Pesa code"} htmlFor="mr" hint={kind === "bank" ? "From your bank's confirmation or slip." : "From the confirmation SMS, e.g. SJK4H7Q2LM."}>
          <Input id="mr" required value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} className="num tracking-wider" />
        </Field>
        <Button type="submit" loading={busy} disabled={missing} className="w-full">I've paid</Button>
      </form>
    </div>
  );
}
