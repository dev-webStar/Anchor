import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { listOrders, setOrderPaid, setOrderStatus } from "@/lib/api/org.functions";
import { dayLabel, money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Empty, Input, Loading, PageTitle, Panel, Segmented, Select, Status } from "@/components/kit";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/orders")({ component: Orders });

type Filter = "open" | "fulfilled" | "cancelled" | "all";

function Orders() {
  const { currency } = useActive();
  const fn = useServerFn(listOrders);
  const move = useServerFn(setOrderStatus);
  const pay = useServerFn(setOrderPaid);
  const qc = useQueryClient();
  const [status, setStatus] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["orders", status, q, days],
    queryFn: () => fn({ data: { status, q: q || undefined, days } }),
    refetchInterval: 20_000,
  });

  async function act(id: string, f: () => Promise<unknown>, msg: string) {
    setBusy(id);
    try {
      await f();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const groups = new Map<string, NonNullable<typeof data>>();
  for (const o of data ?? []) {
    const k = format(new Date(o.created_at), "yyyy-MM-dd");
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const total = (data ?? []).reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageTitle title="Orders" jp="注文">Orders from resellers, their store links and the office. Commission counts once an order is fulfilled.</PageTitle>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Segmented<Filter>
          value={status}
          onChange={setStatus}
          options={[
            { value: "open", label: "To do" },
            { value: "fulfilled", label: "Fulfilled" },
            { value: "cancelled", label: "Cancelled" },
            { value: "all", label: "All" },
          ]}
        />
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-40" aria-label="Period">
          <option value="1">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </Select>
        <Input placeholder="Customer, phone, seller or ref" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Panel>
          <Empty title={status === "open" ? "Nothing waiting" : "No orders here"}>{status === "open" ? "New orders from your network land here." : "Try another filter or a longer period."}</Empty>
        </Panel>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">
            <span className="num font-bold text-ink">{data.length}</span> orders · <span className="num font-bold text-ink">{money(total, currency)}</span>
          </p>
          <div className="space-y-9">
            {[...groups.entries()].map(([day, rows]) => (
              <section key={day}>
                <h2 className="mb-1 flex items-baseline justify-between border-b-2 border-ink pb-2">
                  <span className="text-[15px] font-bold">{dayLabel(day)}</span>
                  <span className="num text-[13px] text-ink-2">{rows.length}</span>
                </h2>
                <ul className="divide-y divide-rule">
                  {rows.map((o) => (
                    <li key={o.id} className="grid gap-x-5 gap-y-2 py-4 md:grid-cols-[64px_1.3fr_1fr_130px_auto] md:items-center">
                      <span className="num text-[20px] leading-none font-bold">{format(new Date(o.created_at), "HH:mm")}</span>
                      <span className="min-w-0">
                        <span className="block font-bold">
                          {o.customer_name}
                          {o.customer_phone && <span className="num font-normal text-ink-2"> · {o.customer_phone}</span>}
                        </span>
                        <span className="block text-[13px] text-ink-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                        {o.note && <span className="mt-1 block text-[13px] text-ink-3 italic">“{o.note}”</span>}
                      </span>
                      <span className="text-[14px]">
                        <span className="block font-bold">{o.reseller ?? "Office"}</span>
                        <span className="block text-[12px] text-ink-3">
                          {o.source === "storefront" ? "From their store link" : o.source === "office" ? "Entered at the office" : "Recorded by seller"} · <span className="num">{o.ref}</span>
                        </span>
                      </span>
                      <span>
                        <span className="num block font-bold">{money(o.total, currency)}</span>
                        <button
                          onClick={() => act(o.id, () => pay({ data: { orderId: o.id, paid: !o.paid } }), o.paid ? "Marked unpaid." : "Marked paid.")}
                          className={cn("text-[12px] font-bold underline-offset-2 hover:underline", o.paid ? "text-wakatake" : "text-ink-3")}
                        >
                          {o.paid ? "Paid ✓" : "Not paid yet"}
                        </button>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Status status={o.status} className="mr-1" />
                        {o.status === "new" && (
                          <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => act(o.id, () => move({ data: { orderId: o.id, status: "confirmed" } }), "Confirmed.")}>
                            Confirm
                          </Button>
                        )}
                        {(o.status === "new" || o.status === "confirmed") && (
                          <>
                            <Button size="sm" disabled={busy === o.id} onClick={() => act(o.id, () => move({ data: { orderId: o.id, status: "fulfilled" } }), "Fulfilled. Commission added.")}>
                              Fulfilled
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === o.id}
                              onClick={() => confirm(`Cancel order ${o.ref}?`) && act(o.id, () => move({ data: { orderId: o.id, status: "cancelled" } }), "Cancelled. Stock returned.")}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
