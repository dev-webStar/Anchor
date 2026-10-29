import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { getPlans } from "@/lib/api/billing.functions";
import { cn } from "@/lib/cn";
import { amount } from "@/lib/format";
import { Segmented, Status } from "@/components/kit";
import { AnchorMark, Logo } from "@/components/logo";
import { NetworkMap } from "@/components/network-map";

export const Route = createFileRoute("/")({
  loader: () => getPlans(),
  component: Home,
});

const HERO_LINES = [
  { name: "Nairobi line", stations: [{ name: "Wanjiku", value: "KES 84,200" }, { name: "Kevin", value: "KES 51,900" }, { name: "Amina", value: "KES 47,300" }, { name: "Otieno", value: "KES 39,800" }] },
  { name: "Lakes line", stations: [{ name: "Brian", value: "KES 62,100" }, { name: "Akinyi", value: "KES 28,400" }, { name: "Ochieng", value: "KES 19,750" }] },
  { name: "Coast line", stations: [{ name: "Fatuma", value: "KES 58,600" }, { name: "Said", value: "KES 33,900" }, { name: "Neema", value: "KES 21,300" }] },
];

const INDUSTRIES = [
  "Beauty & personal care",
  "FMCG distribution",
  "Solar & energy",
  "Insurance agents",
  "Agro-inputs",
  "Fashion & textiles",
  "Pharmacy supplies",
  "Airtime & data",
  "Books & education",
  "Water & purifiers",
];

function Home() {
  const plans = Route.useLoaderData();
  return (
    <div className="overflow-x-clip">
      <Nav />
      <Hero />
      <Industries />
      <Features />
      <Steps />
      <Roles />
      <Pricing plans={plans} />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ---------------- Nav ---------------- */

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule-2/70 bg-stone/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 md:px-8">
        <Link to="/" aria-label="Anchor Hub home">
          <Logo size={36} />
        </Link>
        <nav className="hidden items-center gap-7 text-[15px] font-bold text-ink-2 lg:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <a href="#faq" className="hover:text-ink">Questions</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden h-10 items-center rounded-[8px] px-3 text-sm font-bold text-ink-2 hover:text-ink sm:inline-flex">
            Sign in
          </Link>
          <Link to="/signup" className="inline-flex h-10 items-center rounded-[8px] bg-ink px-4 text-sm font-bold text-paper hover:bg-ink/88">
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 md:px-8 md:pt-20">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <h1 className="max-w-[17ch] font-mincho text-[44px] leading-[1.04] font-extrabold tracking-[-0.025em] md:text-[72px]">
              Your reseller network, run like a railway.
            </h1>
            <p className="mt-6 max-w-[56ch] text-[18px] leading-relaxed text-ink-2">
              Anchor Hub gives any company that sells through people one place to recruit resellers, share its catalogue, take orders, pay
              commissions and send payouts. Subscribe monthly and pay by M-Pesa or bank.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="inline-flex h-13 items-center rounded-[10px] bg-yamabuki px-6 text-[16px] font-bold text-ink shadow-[0_2px_0_#c58f00] hover:brightness-[1.04]">
                Start your 14-day free trial
              </Link>
              <a href="#features" className="inline-flex h-13 items-center rounded-[10px] border border-rule-2 bg-paper px-6 text-[16px] font-bold hover:border-ink-3">
                See everything it does
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-2">No card needed. Set up in an afternoon.</p>
          </div>
          <p aria-hidden lang="ja" className="tategaki hidden font-mincho text-[64px] leading-none font-extrabold text-ink/[0.07] lg:block">
            販売網
          </p>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-[1200px] px-2 md:px-8">
        <div className="rounded-[22px] border border-rule-2 bg-paper/70 px-2 py-6 md:px-8 md:py-8">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 px-3">
            <p className="text-[15px] font-bold">Savanna Naturals · this month</p>
            <p className="text-[13px] text-ink-2">Every station is a seller. Every line is a region.</p>
          </div>
          <NetworkMap hub="Savanna Naturals" lines={HERO_LINES} />
        </div>
      </div>
    </section>
  );
}

function Industries() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pt-14 md:px-8">
      <p className="text-[15px] font-bold text-ink-2">Built for any company that sells through people</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {INDUSTRIES.map((i) => (
          <li key={i} className="rounded-full border border-rule-2 bg-paper px-3.5 py-1.5 text-[14px] font-medium">
            {i}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Features: one line, many stations ---------------- */

type Feature = { title: string; jp: string; body: string; points: string[]; preview: ReactNode; color: string };

const FEATURES: Feature[] = [
  {
    title: "Recruit with one link",
    jp: "募集",
    color: "border-yamabuki",
    body: "Share your join link on WhatsApp or in the field. New resellers sign up themselves and wait for your approval.",
    points: ["Approve, put on hold or remove in a tap", "Add people directly with a starter password", "Plan limits are checked for you"],
    preview: <RecruitPreview />,
  },
  {
    title: "A catalogue that sells itself",
    jp: "商品",
    color: "border-ai",
    body: "Products, prices, units and stock in one list. Every category gets its own coloured line on the order screen.",
    points: ["Track stock or leave it open", "Hide products without deleting them", "Any unit: jar, bag, policy, kit, hour"],
    preview: <MachinePreview />,
  },
  {
    title: "Orders from sellers and their stores",
    jp: "注文",
    color: "border-wakatake",
    body: "Resellers record sales on their phone. Each one also gets a personal store link, so customers can order straight from them.",
    points: ["Confirm, fulfil or cancel each order", "Mark orders paid as money comes in", "Cancelled orders return their stock"],
    preview: <OrdersPreview />,
  },
  {
    title: "Commissions worked out for you",
    jp: "手数料",
    color: "border-fuji",
    body: "Set a default rate, build tiers like Bronze, Silver and Gold, and override by product or by person. Every order shows what the seller earned.",
    points: ["Product rate beats personal rate beats tier", "Earnings count only when an order is fulfilled", "Sellers see exactly what each sale paid"],
    preview: <TiersPreview />,
  },
  {
    title: "Payouts by M-Pesa or bank",
    jp: "支払",
    color: "border-shu",
    body: "Resellers request a payout from what they've earned. You send the money and record the M-Pesa or bank reference.",
    points: ["Nobody can request more than they've earned", "Every payout keeps its reference", "Sellers' payout details are saved"],
    preview: <PayoutPreview />,
  },
  {
    title: "Announcements to the whole network",
    jp: "告知",
    color: "border-yamabuki",
    body: "New stock, a promotion, a change in payout day. Post it once and every reseller sees it on their home screen.",
    points: ["Pin the one that matters most", "No WhatsApp group chaos"],
    preview: <NoticePreview />,
  },
  {
    title: "Know who is selling",
    jp: "実績",
    color: "border-ai",
    body: "Thirty-day sales, a leaderboard, best-selling products and the commission you owe, all on one overview.",
    points: ["Resellers see their own rank this month", "Spot regions that are slowing down"],
    preview: <LeaderPreview />,
  },
  {
    title: "Billing that fits East Africa",
    jp: "請求",
    color: "border-wakatake",
    body: "Pay your subscription with an M-Pesa prompt on your phone, through Paybill, or by bank transfer. Annual plans get two months free.",
    points: ["14-day free trial on every plan", "Upgrade or downgrade any time"],
    preview: <BillingPreview />,
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 pt-24 md:px-8 md:pt-32">
      <div className="max-w-[60ch]">
        <h2 className="font-mincho text-[34px] leading-tight font-extrabold tracking-[-0.015em] md:text-[46px]">Everything your network needs, on one line.</h2>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
          Eight stops, one system. Every company account gets all of it from the first day of the trial.
        </p>
      </div>
      <ol className="relative mt-14">
        <span aria-hidden className="absolute top-3 bottom-3 left-[13px] w-[5px] rounded-full bg-ink md:left-[15px]" />
        {FEATURES.map((f) => (
          <li key={f.title} className="relative grid gap-6 pb-16 pl-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 md:pb-24 md:pl-16">
            <span aria-hidden className={cn("absolute top-1.5 left-0 size-[31px] rounded-full border-[7px] bg-paper md:size-[35px]", f.color)} />
            <div>
              <p className="flex items-baseline gap-2.5">
                <span className="font-mincho text-[26px] leading-tight font-extrabold md:text-[30px]">{f.title}</span>
                <span lang="ja" className="shrink-0 text-sm whitespace-nowrap text-ink-3">{f.jp}</span>
              </p>
              <p className="mt-3 max-w-[52ch] text-[16px] leading-relaxed text-ink-2">{f.body}</p>
              <ul className="mt-4 space-y-1.5">
                {f.points.map((p) => (
                  <li key={p} className="flex gap-2.5 text-[15px]">
                    <span className="mt-[9px] h-[3px] w-3 shrink-0 rounded-full bg-ink" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden className="pointer-events-none select-none">{f.preview}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---- previews: small, static pieces of the real interface ---- */

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[16px] border border-rule-2 bg-paper p-4 shadow-[0_20px_40px_-28px_rgb(22_24_27/0.45)] md:p-5", className)}>{children}</div>;
}

function RecruitPreview() {
  return (
    <Frame>
      <p className="text-[13px] font-bold text-ink-2">Your join link</p>
      <p className="num mt-0.5 truncate text-[16px] font-bold">/join/SAVANNA8</p>
      <div className="mt-4 divide-y divide-rule border-t border-rule">
        {[
          ["Mercy Atieno", "Kakamega", "pending"],
          ["Kevin Mutua", "Machakos", "active"],
          ["Grace Njeri", "Nakuru", "active"],
        ].map(([n, r, s]) => (
          <div key={n} className="flex items-center justify-between py-3">
            <div>
              <p className="font-bold">{n}</p>
              <p className="text-[13px] text-ink-2">{r}</p>
            </div>
            {s === "pending" ? <span className="rounded-[7px] bg-ink px-3 py-1.5 text-sm font-bold text-paper">Approve</span> : <Status status="active" />}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function MachinePreview() {
  const keys = [
    ["Raw shea butter", "250g jar", "650", "bg-yamabuki"],
    ["Black soap bar", "per bar", "280", "bg-ai"],
    ["Baobab oil", "100ml", "1,450", "bg-wakatake"],
    ["Starter gift box", "per box", "2,400", "bg-fuji"],
  ];
  return (
    <Frame className="bg-stone-2/60">
      <div className="grid grid-cols-2 gap-2.5">
        {keys.map(([n, u, p, b]) => (
          <div key={n} className="machine-key overflow-hidden">
            <span className={cn("block h-[5px]", b)} />
            <div className="px-3 pt-2.5 pb-3">
              <p className="text-[16px] leading-tight font-black">{n}</p>
              <p className="text-[12px] text-ink-2">{u}</p>
              <p className="num mt-3 text-[16px] font-bold"><span className="text-[11px] text-ink-2">KES </span>{p}</p>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function OrdersPreview() {
  return (
    <Frame>
      <p className="mb-2 flex items-baseline justify-between border-b-2 border-ink pb-2 text-[15px] font-bold">
        Today <span className="num text-[13px] font-normal text-ink-2">3 orders</span>
      </p>
      {[
        ["09:42", "Mary W.", "via Wanjiku's store", "KES 1,930", "new"],
        ["08:15", "John K.", "by Brian", "KES 3,900", "confirmed"],
        ["07:58", "Aisha M.", "by Fatuma", "KES 650", "fulfilled"],
      ].map(([t, c, by, v, s]) => (
        <div key={t} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-rule py-3 last:border-0">
          <span className="num text-[17px] font-bold">{t}</span>
          <span>
            <span className="block font-bold">{c}</span>
            <span className="block text-[12px] text-ink-2">{by}</span>
          </span>
          <span className="text-right">
            <span className="num block font-bold">{v}</span>
            <Status status={s} />
          </span>
        </div>
      ))}
    </Frame>
  );
}

function TiersPreview() {
  return (
    <Frame>
      <div className="grid grid-cols-3 gap-2">
        {[
          ["Bronze", "8%", "bg-[#b07a46]"],
          ["Silver", "10%", "bg-ink-3"],
          ["Gold", "12.5%", "bg-yamabuki"],
        ].map(([n, r, c]) => (
          <div key={n} className="rounded-[10px] border border-rule p-3">
            <span className={cn("block h-1.5 w-8 rounded-full", c)} />
            <p className="mt-2 text-[14px] font-bold">{n}</p>
            <p className="num text-[24px] font-black">{r}</p>
          </div>
        ))}
      </div>
      <div className="ticket mt-4 flex items-center justify-between bg-stone/70 px-5 py-3">
        <span className="text-[14px]">Order A7K2Q · Gold seller</span>
        <span className="num font-bold text-wakatake">+KES 487.50</span>
      </div>
    </Frame>
  );
}

function PayoutPreview() {
  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">Wanjiku Kamau</p>
          <p className="num text-[13px] text-ink-2">M-Pesa · 0722 111 222</p>
        </div>
        <p className="num text-[22px] font-black">KES 2,000</p>
      </div>
      <div className="mt-4 rounded-[10px] border border-rule bg-stone/50 p-3">
        <p className="text-[13px] font-bold text-ink-2">M-Pesa reference</p>
        <p className="num mt-1 text-[17px] font-bold tracking-wider">SJK4H7Q2LM</p>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-[8px] bg-ink py-2.5 text-center text-sm font-bold text-paper">Mark paid</span>
        <span className="rounded-[8px] border border-shu/30 px-4 py-2.5 text-center text-sm font-bold text-shu">Reject</span>
      </div>
    </Frame>
  );
}

function NoticePreview() {
  return (
    <Frame>
      <p className="flex items-center gap-2 text-[12px] font-bold text-shu">
        <span className="size-2 rounded-[2px] bg-shu" /> Pinned
      </p>
      <p className="mt-2 font-mincho text-[22px] leading-tight font-extrabold">December stock is in</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Gift boxes and the family bundle are back. Gold sellers earn 12% on both until the end of the month.</p>
      <p className="mt-3 text-[12px] text-ink-3">Achieng · 2 hours ago</p>
    </Frame>
  );
}

function LeaderPreview() {
  const rows: [string, number][] = [
    ["Wanjiku", 84200],
    ["Brian", 62100],
    ["Fatuma", 58600],
    ["Kevin", 51900],
  ];
  return (
    <Frame>
      {rows.map(([n, v], i) => (
        <div key={n} className="grid grid-cols-[22px_80px_1fr_auto] items-center gap-3 py-2">
          <span className="num text-[15px] font-black text-ink-3">{i + 1}</span>
          <span className="font-bold">{n}</span>
          <span className="h-2.5 rounded-full bg-stone-2">
            <span className="block h-full rounded-full bg-ai" style={{ width: `${(v / rows[0][1]) * 100}%` }} />
          </span>
          <span className="num text-[14px] font-bold">{amount(v)}</span>
        </div>
      ))}
    </Frame>
  );
}

function BillingPreview() {
  return (
    <Frame className="mx-auto max-w-[300px] rounded-[28px] border-[6px] border-ink bg-ink p-0">
      <div className="rounded-[20px] bg-paper px-5 pt-6 pb-5">
        <p className="text-center text-[12px] font-bold text-ink-2">M-PESA</p>
        <p className="mt-3 text-center text-[15px] leading-snug">
          Pay <b className="num">KES 7,900</b> to <b>Anchor Hub</b> account <b className="num">SAVANNANATUR</b>?
        </p>
        <p className="mt-4 rounded-[8px] border border-rule-2 px-3 py-2.5 text-center text-[13px] tracking-[0.5em] text-ink-3">••••</p>
        <p className="mt-3 rounded-[8px] bg-wakatake py-2.5 text-center text-sm font-bold text-paper">Send</p>
      </div>
    </Frame>
  );
}

/* ---------------- Steps (a real sequence) ---------------- */

function Steps() {
  const steps = [
    ["Create your company", "Name, industry, your phone. The 14-day trial starts at once."],
    ["Add products and rates", "Upload what you sell and set the commission each seller earns."],
    ["Share your join link", "Resellers sign up from their phones. You approve who joins."],
    ["Sell and fulfil", "Orders arrive from sellers and their store links. You confirm and deliver."],
    ["Pay commissions", "Earnings add up as orders are fulfilled. Send payouts by M-Pesa or bank."],
  ];
  return (
    <section id="how" className="scroll-mt-20 border-y border-rule-2 bg-paper/60">
      <div className="mx-auto max-w-[1200px] px-4 py-20 md:px-8 md:py-24">
        <h2 className="font-mincho text-[34px] leading-tight font-extrabold md:text-[42px]">From sign-up to first payout</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-5 md:gap-6">
          {steps.map(([t, d], i) => (
            <li key={t} className="relative">
              <div className="flex items-center gap-3">
                <span className="num grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[15px] font-bold text-paper">{i + 1}</span>
                {i < steps.length - 1 && <span aria-hidden className="hidden h-[3px] flex-1 rounded-full bg-rule-2 md:block" />}
              </div>
              <p className="mt-4 text-[17px] font-bold">{t}</p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------- Roles ---------------- */

function Roles() {
  const roles = [
    { who: "The company", jp: "本社", color: "bg-ink", items: ["Overview of sales and commission owed", "Resellers, tiers and approvals", "Catalogue, stock and orders", "Payouts and announcements", "Billing and plan"] },
    { who: "Each reseller", jp: "販売員", color: "bg-yamabuki", items: ["Record a sale in seconds", "Personal store link to share", "Earnings, rank and payout requests", "Company announcements"] },
    { who: "Their customers", jp: "お客様", color: "bg-wakatake", items: ["Browse the seller's store", "Order without an account", "Seller follows up by phone"] },
  ];
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-20 md:px-8 md:py-28">
      <h2 className="max-w-[24ch] font-mincho text-[34px] leading-tight font-extrabold md:text-[42px]">One system, three doors</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {roles.map((r) => (
          <div key={r.who} className="rounded-[16px] border border-rule-2 bg-paper p-6">
            <span className={cn("block h-1.5 w-10 rounded-full", r.color)} />
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-[20px] font-black">{r.who}</span>
              <span lang="ja" className="text-xs text-ink-3">{r.jp}</span>
            </p>
            <ul className="mt-4 space-y-2">
              {r.items.map((x) => (
                <li key={x} className="text-[15px] text-ink-2">{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

type Plan = Awaited<ReturnType<typeof getPlans>>[number];

function Pricing({ plans }: { plans: Plan[] }) {
  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  return (
    <section id="pricing" className="scroll-mt-20 bg-ink text-paper">
      <div className="mx-auto max-w-[1200px] px-4 py-20 md:px-8 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-mincho text-[34px] leading-tight font-extrabold md:text-[46px]">Simple monthly plans</h2>
            <p className="mt-3 max-w-[54ch] text-[17px] text-paper/70">
              Every plan has every feature. Plans differ by how many resellers, products and staff you need. Prices in Kenyan shillings.
            </p>
          </div>
          <div className="rounded-[10px] bg-paper p-0.5">
            <Segmented
              value={period}
              onChange={setPeriod}
              className="border-0 bg-transparent text-ink"
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Yearly · 2 months free" },
              ]}
            />
          </div>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((p) => {
            const featured = p.id === "growth";
            const price = period === "monthly" ? p.price_monthly : p.price_monthly * 10;
            return (
              <div key={p.id} className={cn("flex flex-col rounded-[18px] p-6 md:p-7", featured ? "bg-yamabuki text-ink" : "border border-paper/15 bg-paper/[0.04]")}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] font-black">{p.name}</p>
                  {featured && <span className="rounded-full bg-ink px-2.5 py-1 text-[12px] font-bold text-paper">Most chosen</span>}
                </div>
                <p className={cn("mt-1 text-[15px]", featured ? "text-ink/75" : "text-paper/65")}>{p.blurb}</p>
                <p className="num mt-6 flex items-baseline gap-1.5">
                  <span className="text-[15px] font-bold">KES</span>
                  <span className="text-[44px] leading-none font-black tracking-[-0.03em]">{amount(price)}</span>
                  <span className={cn("text-[15px]", featured ? "text-ink/70" : "text-paper/60")}>/{period === "monthly" ? "month" : "year"}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5 text-[15px]">
                      <span className={cn("mt-[9px] h-[3px] w-3 shrink-0 rounded-full", featured ? "bg-ink" : "bg-yamabuki")} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  search={{ plan: p.id as "starter" | "growth" | "scale" }}
                  className={cn("mt-8 inline-flex h-12 items-center justify-center rounded-[10px] text-[15px] font-bold", featured ? "bg-ink text-paper" : "bg-paper text-ink")}
                >
                  Try {p.name} free for 14 days
                </Link>
              </div>
            );
          })}
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["M-Pesa prompt", "Enter your PIN on the prompt we send to your phone. Your plan starts at once."],
            ["M-Pesa Paybill", "Pay with your company code as the account number and paste the M-Pesa code."],
            ["Bank transfer", "Transfer from any Kenyan or East African bank and send us the reference."],
          ].map(([t, d]) => (
            <div key={t} className="border-t border-paper/20 pt-4">
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-[15px] text-paper/65">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function Faq() {
  const qs = [
    ["We don't sell physical goods. Does it still work?", "Yes. Products can be anything with a price: insurance policies, training seats, installations, subscriptions. Set the unit to whatever you sell by."],
    ["Do resellers pay anything?", "No. Your company pays one subscription. Resellers and their customers use Anchor Hub for free."],
    ["How do customers pay for orders?", "However you already take payment: M-Pesa, cash on delivery or bank. Mark each order paid when the money arrives."],
    ["What happens when the trial ends?", "Pick a plan and pay by M-Pesa or bank. If you don't, your data stays safe and you can still sign in, but new orders pause until you renew."],
    ["Can one person sell for two companies?", "Yes. A reseller can belong to more than one company and switch between them with the same login."],
    ["Can we move our existing resellers in?", "Send them your join link, or add them yourself with their phone and email. Each gets a starter password."],
  ];
  return (
    <section id="faq" className="mx-auto max-w-[900px] scroll-mt-20 px-4 py-20 md:px-8 md:py-28">
      <h2 className="font-mincho text-[34px] leading-tight font-extrabold md:text-[42px]">Questions companies ask</h2>
      <div className="mt-8 divide-y divide-rule-2 border-y border-rule-2">
        {qs.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold">
              {q}
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-rule-2 text-ink-2 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-ink-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-24 md:px-8">
      <div className="relative overflow-hidden rounded-[22px] bg-ai px-6 py-14 text-paper md:px-14 md:py-20">
        <div className="seigaiha absolute inset-0 opacity-70" />
        <div className="absolute inset-x-0 top-0 h-2 bg-yamabuki" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <h2 className="max-w-[20ch] font-mincho text-[34px] leading-tight font-extrabold md:text-[46px]">Drop anchor. Give your sellers a home.</h2>
            <p className="mt-3 max-w-[50ch] text-[17px] text-paper/75">Fourteen days free. Your first resellers can be selling today.</p>
          </div>
          <Link to="/signup" className="inline-flex h-13 items-center rounded-[10px] bg-yamabuki px-7 text-[16px] font-bold text-ink shadow-[0_2px_0_#c58f00]">
            Start free trial
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule-2">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-2 md:px-8">
        <span className="flex items-center gap-2.5">
          <AnchorMark size={24} />
          <span className="font-bold text-ink">Anchor Hub · Reseller system</span>
        </span>
        <span className="flex gap-6">
          <a href="#pricing" className="hover:text-ink">Pricing</a>
          <Link to="/login" className="hover:text-ink">Sign in</Link>
          <Link to="/signup" className="hover:text-ink">Start free trial</Link>
        </span>
      </div>
    </footer>
  );
}
