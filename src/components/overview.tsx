import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { getOverview } from "@/lib/api/org.functions";
import { amount, firstName, greeting, money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Loading, Panel, SectionHead, Stat } from "@/components/kit";
import { NetworkMap } from "@/components/network-map";

export function CompanyOverview() {
  const { viewer, org, currency } = useActive();
  const fn = useServerFn(getOverview);
  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => fn(), refetchInterval: 60_000 });

  const lines = useMemo(() => {
    if (!data) return [];
    const byRegion = new Map<string, { name: string; value: string; sales: number }[]>();
    for (const l of data.leaders) {
      const r = l.region || "Other";
      byRegion.set(r, [...(byRegion.get(r) ?? []), { name: firstName(l.name), value: money(l.sales, currency), sales: l.sales }]);
    }
    return [...byRegion.entries()]
      .map(([name, stations]) => ({ name, stations, total: stations.reduce((s, x) => s + x.sales, 0) }))
      .sort((a, b) => b.total - a.total);
  }, [data, currency]);

  if (isLoading || !data || !org || !viewer) return <Loading />;

  const queue = [
    { to: "/app/orders", n: data.openOrders, label: "orders to confirm or fulfil" },
    { to: "/app/resellers", n: data.pendingResellers, label: "resellers waiting for approval" },
    { to: "/app/payouts", n: data.payoutRequests, label: `payout requests (${money(data.payoutRequested, currency)})` },
  ];
  const setup = [
    { done: data.products > 0, label: "Add your products", to: "/app/products" },
    { done: data.resellers > 0, label: "Share your join link with resellers", to: "/app/resellers" },
    { done: data.announcements > 0, label: "Post a welcome announcement", to: "/app/notices" },
  ];
  const settingUp = setup.some((s) => !s.done);

  return (
    <>
      <h1 className="font-mincho text-[30px] leading-tight font-extrabold tracking-[-0.01em] md:text-[40px]">
        {greeting()}, {firstName(viewer.user.name)}.
      </h1>
      <p className="mt-1 text-[15px] text-ink-2">{format(new Date(), "EEEE d MMMM")} · {org.name}</p>

      {settingUp && (
        <Panel className="mt-8 p-5">
          <p className="font-bold">Get your network moving</p>
          <ol className="mt-3 grid gap-2 md:grid-cols-3">
            {setup.map((s, i) => (
              <li key={s.label}>
                <Link to={s.to} className="flex items-center gap-3 rounded-[10px] border border-rule px-3 py-3 hover:border-ink-3">
                  <span className={`num grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${s.done ? "bg-wakatake text-paper" : "border border-ink"}`}>
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={s.done ? "text-ink-2 line-through" : "font-bold"}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      <section className="mt-10">
        <div className="grid gap-3 md:grid-cols-3">
          {queue.map((q) => (
            <Link key={q.to} to={q.to} className="group flex items-center gap-4 rounded-[14px] border border-rule bg-paper p-4 transition-colors hover:border-ink-3">
              <span className={`num text-[34px] leading-none font-black ${q.n > 0 ? "text-ink" : "text-ink-3"}`}>{q.n}</span>
              <span className="text-[15px] leading-snug text-ink-2 group-hover:text-ink">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Sales, 30 days" value={money(data.sales30, currency)} note={`${data.orders30} orders`} tone="yamabuki" />
        <Stat label="Commission owed" value={money(data.commissionOwed, currency)} note="Earned, not yet paid" tone="shu" />
        <Stat label="Active resellers" value={data.resellers} note={data.pendingResellers ? `${data.pendingResellers} waiting` : undefined} tone="ai" />
        <Stat label="Products" value={data.products} tone="wakatake" />
      </div>

      {lines.length > 0 && (
        <section className="mt-12">
          <SectionHead title="Your network this month" jp="路線図" />
          <Panel className="px-2 py-4 md:px-6">
            <NetworkMap hub={org.name} lines={lines} animate={false} maxStations={5} />
          </Panel>
        </section>
      )}

      {data.daily.some((d) => d.sales > 0) && <SalesChart days={data.daily} currency={currency} />}

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <SectionHead title="Top sellers, 30 days" jp="実績" right={<Link to="/app/resellers" className="text-sm font-bold text-ink-2 hover:text-ink">All resellers</Link>} />
          {data.leaders.length === 0 ? (
            <p className="border-y border-rule py-6 text-ink-2">No sales yet.</p>
          ) : (
            <ol className="divide-y divide-rule border-y border-rule">
              {data.leaders.map((l, i) => (
                <li key={l.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 py-3">
                  <span className="num text-[15px] font-black text-ink-3">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{l.name}</span>
                    <span className="block text-[13px] text-ink-2">{l.region ?? "No region"} · {l.orders} orders</span>
                  </span>
                  <span className="num font-bold">{money(l.sales, currency)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section>
          <SectionHead title="Best-selling products" jp="人気" right={<Link to="/app/products" className="text-sm font-bold text-ink-2 hover:text-ink">Products</Link>} />
          {data.topProducts.length === 0 ? (
            <p className="border-y border-rule py-6 text-ink-2">No sales yet.</p>
          ) : (
            <ul className="divide-y divide-rule border-y border-rule">
              {data.topProducts.map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="num block text-[13px] text-ink-2">{amount(p.qty)} sold</span>
                  </span>
                  <span className="num font-bold">{money(p.sales, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function SalesChart({ days, currency }: { days: { day: string; sales: number; orders: number }[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.sales));
  const shown = hover ?? days.length - 1;
  const d = days[shown];
  return (
    <section className="mt-12">
      <SectionHead title="Sales, last 30 days" jp="売上推移" />
      <Panel className="p-5 md:p-6">
        <p className="mb-5 text-[15px]">
          <span className="font-bold">{format(new Date(d.day), "EEE d MMM")}</span>
          <span className="text-ink-2">
            {" "}— <span className="num font-bold text-ink">{money(d.sales, currency)}</span> from {d.orders} {d.orders === 1 ? "order" : "orders"}
          </span>
        </p>
        <div className="relative h-44" onMouseLeave={() => setHover(null)}>
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-rule" />
          <span className="num pointer-events-none absolute -top-2.5 right-0 bg-paper pl-2 text-[12px] text-ink-3">{money(max, currency)}</span>
          <div className="absolute inset-0 flex items-end gap-[2px] border-b border-rule-2">
            {days.map((x, i) => (
              <button
                key={x.day}
                type="button"
                aria-label={`${format(new Date(x.day), "d MMM")}: ${money(x.sales, currency)}, ${x.orders} orders`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                className="flex h-full flex-1 items-end justify-center"
              >
                <span className={`w-full max-w-[22px] rounded-t-[4px] transition-colors ${i === shown ? "bg-ai" : "bg-ai/35"}`} style={{ height: `${Math.max(x.sales > 0 ? 3 : 0, (x.sales / max) * 100)}%` }} />
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[12px] text-ink-3">
          <span>{format(new Date(days[0].day), "d MMM")}</span>
          <span>Today</span>
        </div>
      </Panel>
    </section>
  );
}
