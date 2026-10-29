import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listMyPayouts, requestPayout } from "@/lib/api/seller.functions";
import { money, shortDate } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Field, Input, Loading, PageTitle, Panel, SectionHead, Segmented, Stat, Status } from "@/components/kit";
import { EarningsCard } from "@/components/bits";

export const Route = createFileRoute("/app/earnings")({ component: Earnings });

function Earnings() {
  const { org, viewer, currency } = useActive();
  const fn = useServerFn(listMyPayouts);
  const req = useServerFn(requestPayout);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-payouts"], queryFn: () => fn() });
  const [method, setMethod] = useState<"mpesa" | "bank">("mpesa");
  const [dest, setDest] = useState("");
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) {
      setMethod(data.payout.method ?? "mpesa");
      setDest(data.payout.details ?? viewer?.user.phone ?? "");
    }
  }, [data?.payout.details]);
  if (isLoading || !data || !org) return <Loading />;
  const n = Number(amt);

  return (
    <>
      <PageTitle title="Earnings" jp="収入">Commission on fulfilled orders. Request it any time; the company sends it by M-Pesa or bank.</PageTitle>
      <div className="grid gap-8 lg:grid-cols-[400px_1fr] lg:items-start">
        <EarningsCard available={data.earnings.available} currency={currency} holder={viewer?.user.name ?? ""} company={org.name} />
        <div className="grid grid-cols-2 gap-6">
          <Stat label="Earned so far" value={money(data.earnings.earned, currency)} tone="yamabuki" />
          <Stat label="Paid to you" value={money(data.earnings.paid, currency)} tone="wakatake" />
          <Stat label="On the way" value={money(data.earnings.pending, currency)} note="On orders not yet fulfilled" tone="ai" />
          <Stat label="Ready to request" value={money(data.earnings.available, currency)} tone="shu" />
        </div>
      </div>

      <section className="mt-12">
        <SectionHead title="Request a payout" jp="出金" />
        <Panel className="p-5 md:p-6">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await req({ data: { amount: n, method, destination: dest } });
                toast.success("Request sent to the company.");
                setAmt("");
                qc.invalidateQueries();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Segmented value={method} onChange={setMethod} options={[{ value: "mpesa", label: "M-Pesa" }, { value: "bank", label: "Bank" }]} />
            <div className="grid gap-4 md:grid-cols-[1fr_200px_auto] md:items-end">
              <Field label={method === "mpesa" ? "M-Pesa number" : "Bank, account number and name"} htmlFor="dest" hint={method === "bank" ? "e.g. Equity · 0123456789012 · Jane Wanjiru" : undefined}>
                <Input id="dest" required value={dest} onChange={(e) => setDest(e.target.value)} className={method === "mpesa" ? "num" : ""} />
              </Field>
              <Field label={`Amount (${currency})`} htmlFor="amt" hint={`Up to ${money(data.earnings.available, currency)}`}>
                <Input id="amt" required inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} className="num" />
              </Field>
              <Button type="submit" variant="yamabuki" loading={busy} disabled={!(n > 0 && n <= data.earnings.available)} className="md:mb-[26px]">Request payout</Button>
            </div>
          </form>
        </Panel>
      </section>

      <section className="mt-12">
        <SectionHead title="Payout history" jp="履歴" />
        {data.rows.length === 0 ? (
          <p className="border-y border-rule py-6 text-ink-2">No payouts yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {data.rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="num font-bold">{money(p.amount, currency)}</p>
                  <p className="truncate text-[13px] text-ink-2">{shortDate(p.created_at)} · {p.method === "mpesa" ? "M-Pesa" : "Bank"} {p.destination}{p.reference ? ` · ref ${p.reference}` : ""}</p>
                </div>
                <Status status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
