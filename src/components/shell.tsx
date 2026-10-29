import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut, switchCompany } from "@/lib/api/auth.functions";
import { useActive } from "@/lib/viewer";
import { Dialog, Hanko, Loading } from "@/components/kit";
import { AnchorMark } from "@/components/logo";

type Stop = { to: string; label: string; jp: string; exact?: boolean };

function Line({ name, color, stops, path, onNavigate }: { name: string; color: "yamabuki" | "ai" | "wakatake"; stops: Stop[]; path: string; onNavigate?: () => void }) {
  const rail = { yamabuki: "bg-yamabuki", ai: "bg-ai", wakatake: "bg-wakatake" }[color];
  const ring = { yamabuki: "border-yamabuki", ai: "border-ai", wakatake: "border-wakatake" }[color];
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 pl-1 text-[12px] font-bold text-ink-3">
        <span className={cn("h-[3px] w-4 rounded-full", rail)} />
        {name}
      </p>
      <ul className="relative">
        <span className={cn("absolute top-[18px] bottom-[18px] left-[17px] w-1 rounded-full", rail)} aria-hidden />
        {stops.map((s) => {
          const active = s.exact ? path === s.to || path === s.to + "/" : path === s.to || path.startsWith(s.to + "/");
          return (
            <li key={s.to}>
              <Link
                to={s.to}
                onClick={onNavigate}
                className={cn("group relative flex items-center gap-3.5 rounded-[10px] py-[7px] pr-3 pl-[9px] transition-colors", active ? "bg-paper" : "hover:bg-paper/60")}
              >
                <span className={cn("relative z-[1] grid size-[20px] shrink-0 place-items-center rounded-full border-[4px] bg-paper transition-transform", ring, active && "scale-110 border-ink")}>
                  {active && <span className="size-1.5 rounded-full bg-ink" />}
                </span>
                <span className="flex min-w-0 items-baseline gap-2 leading-tight">
                  <span className={cn("text-[15px]", active ? "font-black" : "font-medium text-ink-2 group-hover:text-ink")}>{s.label}</span>
                  <span className="truncate text-[11px] text-ink-3" lang="ja">{s.jp}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RailBody({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const { viewer, org, role, isManager, isOwner } = useActive();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const out = useServerFn(signOut);
  const sw = useServerFn(switchCompany);
  if (!viewer || !org) return null;

  const company: Stop[] = [
    { to: "/app", label: "Overview", jp: "概要", exact: true },
    { to: "/app/orders", label: "Orders", jp: "注文" },
    { to: "/app/sell", label: "New order", jp: "販売" },
    { to: "/app/resellers", label: "Resellers", jp: "販売員" },
    { to: "/app/products", label: "Products", jp: "商品" },
    { to: "/app/payouts", label: "Payouts", jp: "支払" },
    { to: "/app/notices", label: "Announcements", jp: "告知" },
    { to: "/app/billing", label: "Billing", jp: "請求" },
    ...(isOwner ? [{ to: "/app/settings", label: "Settings", jp: "設定" }] : []),
  ];
  const seller: Stop[] = [
    { to: "/app", label: "Home", jp: "ホーム", exact: true },
    { to: "/app/sell", label: "Sell", jp: "販売" },
    { to: "/app/my-orders", label: "My orders", jp: "注文" },
    { to: "/app/earnings", label: "Earnings", jp: "収入" },
    { to: "/app/notices", label: "Announcements", jp: "告知" },
  ];
  const others = viewer.memberships.filter((m) => m.org_id !== org.id);

  return (
    <div className="flex h-full flex-col">
      <Link to="/app" onClick={onNavigate} className="flex items-center gap-3 px-2 pb-7">
        <Hanko name={org.name} size={40} />
        <span className="min-w-0 leading-tight">
          <span className="block truncate font-mincho text-[17px] font-extrabold">{org.name}</span>
          <span className="block text-[12px] text-ink-2">{role === "reseller" ? "Reseller" : role === "owner" ? "Owner" : "Manager"} · on Anchor Hub</span>
        </span>
      </Link>
      <nav className="-mx-1 flex-1 space-y-6 overflow-y-auto px-1 pb-6" aria-label="Main">
        {isManager ? <Line name="Company line" color="ai" stops={company} path={path} onNavigate={onNavigate} /> : <Line name="Seller line" color="yamabuki" stops={seller} path={path} onNavigate={onNavigate} />}
        {others.length > 0 && (
          <div>
            <p className="mb-2 pl-1 text-[12px] font-bold text-ink-3">Your other companies</p>
            {others.map((m) => (
              <button
                key={m.org_id}
                onClick={async () => {
                  await sw({ data: { orgId: m.org_id } });
                  qc.clear();
                  onNavigate?.();
                  navigate({ to: "/app" });
                }}
                className="block w-full truncate rounded-[8px] px-3 py-2 text-left text-sm font-bold text-ink-2 hover:bg-paper/70 hover:text-ink"
              >
                {m.org_name}
              </button>
            ))}
          </div>
        )}
      </nav>
      <div className="space-y-1 border-t border-rule-2 pt-4">
        <Link to="/" onClick={onNavigate} className="mb-2 flex items-center gap-2 px-3 py-1 text-[12px] font-bold text-ink-3 hover:text-ink">
          <AnchorMark size={18} /> Anchor Hub
        </Link>
        {viewer.user.is_platform_admin && (
          <Link to="/platform" onClick={onNavigate} className="block rounded-[8px] px-3 py-2 text-sm font-bold text-ai hover:bg-paper/70">
            Anchor Hub admin
          </Link>
        )}
        <Link to="/app/profile" onClick={onNavigate} className="block rounded-[8px] px-3 py-2 text-sm font-bold text-ink-2 hover:bg-paper/70 hover:text-ink">
          {viewer.user.name}
        </Link>
        <button
          onClick={async () => {
            await out();
            qc.clear();
            navigate({ to: "/login" });
          }}
          className="block w-full rounded-[8px] px-3 py-2 text-left text-sm font-bold text-ink-2 hover:bg-paper/70 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AccessBanner() {
  const { access, isManager, member } = useActive();
  if (!access) return null;
  if (member?.status === "pending")
    return <Banner tone="ai">Your account is waiting for the company's approval. You can look around, but selling opens once you're approved.</Banner>;
  if (access.open && access.reason === "trial" && isManager)
    return (
      <Banner tone="ai">
        Free trial: {access.daysLeft} {access.daysLeft === 1 ? "day" : "days"} left.{" "}
        <Link to="/app/billing" className="font-bold underline underline-offset-4">Choose a plan</Link>
      </Banner>
    );
  if (!access.open)
    return (
      <Banner tone="shu">
        {isManager ? (
          <>
            {access.reason === "trial_over" ? "Your free trial has ended." : "Your subscription has lapsed."} New orders are paused.{" "}
            <Link to="/app/billing" className="font-bold underline underline-offset-4">Pay with M-Pesa or bank</Link>
          </>
        ) : (
          "Ordering is paused for this company right now. Your earnings are safe."
        )}
      </Banner>
    );
  return null;
}

function Banner({ tone, children }: { tone: "ai" | "shu"; children: ReactNode }) {
  return (
    <div className={cn("mb-8 flex items-start gap-3 rounded-[12px] border px-4 py-3 text-[15px]", tone === "ai" ? "border-ai/20 bg-ai-soft/60" : "border-shu/25 bg-shu-soft/70")}>
      <span className={cn("mt-[7px] size-2 shrink-0 rounded-[2px]", tone === "ai" ? "bg-ai" : "bg-shu")} />
      <p>{children}</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { viewer, org } = useActive();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  if (!viewer || !org) return <Loading label="Opening your company" />;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-rule-2 bg-stone-2/50 px-4 py-6 md:block">
        <RailBody path={path} />
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-rule-2 bg-stone/90 px-4 backdrop-blur md:hidden">
        <Link to="/app" className="flex min-w-0 items-center gap-2.5">
          <Hanko name={org.name} size={32} />
          <span className="truncate font-mincho text-[15px] font-extrabold">{org.name}</span>
        </Link>
        <button onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-full hover:bg-stone-2" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </header>
      <Dialog open={menu} onOpenChange={setMenu} side="right" title="Menu">
        <RailBody path={path} onNavigate={() => setMenu(false)} />
      </Dialog>
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-7 pb-32 md:px-10 md:pt-12">
        <AccessBanner />
        {children}
      </main>
    </div>
  );
}
