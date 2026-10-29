import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { listMyOrders } from "@/lib/api/seller.functions";
import { dayLabel, money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Empty, Loading, PageTitle, Segmented, Status } from "@/components/kit";

export const Route = createFileRoute("/app/my-orders")({ component: MyOrders });

function MyOrders() {
  const { currency } = useActive();
  const fn = useServerFn(listMyOrders);
  const { data, isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: () => fn(), refetchInterval: 30_000 });
  const [tab, setTab] = useState<"all" | "open" | "fulfilled">("all");
  if (isLoading) return <Loading />;
  const rows = (data ?? []).filter((o) => (tab === "all" ? true : tab === "open" ? o.status === "new" || o.status === "confirmed" : o.status === "fulfilled"));
  const groups = new Map<string, typeof rows>();
  for (const o of rows) {
    const k = format(new Date(o.created_at), "yyyy-MM-dd");
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  return (
    <>
      <PageTitle title="My orders" jp="注文">Orders you recorded and orders customers placed on your store link. Commission is yours once the company fulfils them.</PageTitle>
      <Segmented value={tab} onChange={setTab} className="mb-6" options={[{ value: "all", label: "All" }, { value: "open", label: "With the company" }, { value: "fulfilled", label: "Fulfilled" }]} />
      {rows.length === 0 ? (
        <Empty title="No orders yet" action={<Link to="/app/sell" className="inline-flex h-11 items-center rounded-[8px] bg-ink px-5 font-bold text-paper">Record a sale</Link>}>
          Share your store link or record a sale yourself.
        </Empty>
      ) : (
        <div className="space-y-9">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-1 border-b-2 border-ink pb-2 text-[15px] font-bold">{dayLabel(day)}</h2>
              <ul className="divide-y divide-rule">
                {list.map((o) => (
                  <li key={o.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-x-4 gap-y-1 py-3.5">
                    <span className="num text-[20px] leading-none font-bold">{format(new Date(o.created_at), "HH:mm")}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{o.customer_name}{o.source === "storefront" && <span className="ml-2 rounded-[4px] bg-wakatake-soft px-1.5 py-0.5 text-[11px] font-bold text-wakatake">store link</span>}</span>
                      <span className="block truncate text-[13px] text-ink-2">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-bold">{money(o.total, currency)}</span>
                      <span className="num block text-[12px] font-bold text-wakatake">+{money(o.commission, currency)}</span>
                    </span>
                    <span className="col-start-2"><Status status={o.status} /></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
