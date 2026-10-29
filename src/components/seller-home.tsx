import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { getMyDashboard } from "@/lib/api/seller.functions";
import { firstName, greeting, money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Loading, Panel, SectionHead, Stat } from "@/components/kit";
import { CopyButton, EarningsCard, useOrigin } from "@/components/bits";

export function SellerHome() {
  const { org } = useActive();
  const fn = useServerFn(getMyDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["my-dashboard"], queryFn: () => fn() });
  const origin = useOrigin();
  if (isLoading || !data || !org) return <Loading />;
  const storeUrl = `${origin}/s/${data.orgSlug}/${data.code}`;
  const pending = data.status === "pending";

  return (
    <>
      <h1 className="font-mincho text-[30px] leading-tight font-extrabold tracking-[-0.01em] md:text-[40px]">
        {greeting()}, {firstName(data.name)}.
      </h1>
      <p className="mt-1 text-[15px] text-ink-2">
        {format(new Date(), "EEEE d MMMM")} · selling for {org.name}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[400px_1fr] lg:items-start">
        <div>
          <EarningsCard available={data.earnings.available} currency={data.currency} holder={data.name} company={org.name} note={data.tier ? `${data.tier.name} · ${data.rate}%` : `${data.rate}%`} />
          <div className="mt-4 grid max-w-[400px] grid-cols-2 gap-2.5">
            <Link to="/app/sell" className={`inline-flex h-11 items-center justify-center rounded-[8px] bg-yamabuki font-bold shadow-[0_2px_0_#c58f00] ${pending ? "pointer-events-none opacity-45" : ""}`}>
              Record a sale
            </Link>
            <Link to="/app/earnings" className="inline-flex h-11 items-center justify-center rounded-[8px] border border-rule-2 bg-paper font-bold hover:border-ink-3">
              Request payout
            </Link>
          </div>
        </div>
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <Stat label="Sales this month" value={money(data.month.sales, data.currency)} note={`${data.month.orders} orders`} tone="yamabuki" />
            <Stat label="Your rank this month" value={data.rank ? `${data.rank.position} of ${data.rank.of}` : "—"} tone="ai" />
            <Stat label="On the way" value={money(data.earnings.pending, data.currency)} note="Commission on open orders" tone="wakatake" />
            <Stat label="Paid to you" value={money(data.earnings.paid, data.currency)} tone="shu" />
          </div>
          {!pending && (
            <Panel className="p-4 md:p-5">
              <p className="text-[13px] font-bold text-ink-2">Your store link</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="num min-w-0 flex-1 truncate text-[16px] font-bold">{storeUrl.replace(/^https?:\/\//, "")}</p>
                <CopyButton value={storeUrl} label="Copy store link" />
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Order from me on ${org.name}: ${storeUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex h-10 items-center rounded-[8px] bg-wakatake px-4 text-sm font-bold text-paper"
              >
                Share on WhatsApp
              </a>
            </Panel>
          )}
        </div>
      </div>

      <section className="mt-12">
        <SectionHead title="From the company" jp="告知" right={<Link to="/app/notices" className="text-sm font-bold text-ink-2 hover:text-ink">All announcements</Link>} />
        {data.announcements.length === 0 ? (
          <p className="border-y border-rule py-6 text-ink-2">No announcements yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {data.announcements.map((a) => (
              <Panel key={a.id} className="p-5">
                {a.pinned && (
                  <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-shu">
                    <span className="size-2 rounded-[2px] bg-shu" /> Pinned
                  </p>
                )}
                <p className="font-mincho text-[19px] leading-tight font-extrabold">{a.title}</p>
                <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-ink-2">{a.body}</p>
                <p className="mt-3 text-[12px] text-ink-3">{format(new Date(a.created_at), "d MMM")}</p>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
