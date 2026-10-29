import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getViewer } from "@/lib/api/auth.functions";
import { platformExtendTrial, platformOverview, platformSettlePayment } from "@/lib/api/billing.functions";
import { amount, money, shortDate } from "@/lib/format";
import { AnchorMark } from "@/components/logo";
import { Button, Empty, Loading, Panel, Segmented, Stat, Status, Table, Td, Th } from "@/components/kit";

export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const v = await context.queryClient.fetchQuery({ queryKey: ["viewer"], queryFn: () => getViewer(), staleTime: 30_000 });
    if (!v) throw redirect({ to: "/login" });
    if (!v.user.is_platform_admin) throw redirect({ to: "/app" });
  },
  component: Platform,
});

function Platform() {
  const fn = useServerFn(platformOverview);
  const settle = useServerFn(platformSettlePayment);
  const extend = useServerFn(platformExtendTrial);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["platform"], queryFn: () => fn(), refetchInterval: 30_000 });
  const [tab, setTab] = useState<"payments" | "companies">("payments");
  if (isLoading || !data) return <Loading />;
  const pending = data.payments.filter((p) => p.status === "pending");
  const paying = data.orgs.filter((o) => o.access.reason === "active").length;
  const trials = data.orgs.filter((o) => o.access.reason === "trial").length;

  async function act(f: () => Promise<unknown>, msg: string) {
    try {
      await f();
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["platform"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-8 md:py-12">
      <header className="mb-10 flex items-center justify-between">
        <span className="flex items-center gap-3">
          <AnchorMark size={38} />
          <span className="leading-tight">
            <span className="block font-mincho text-[20px] font-extrabold">Anchor Hub admin</span>
            <span className="block text-[12px] text-ink-2">Companies and subscription payments</span>
          </span>
        </span>
        <Link to="/app" className="text-sm font-bold text-ink-2 hover:text-ink">Back to app</Link>
      </header>
      <div className="mb-10 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={`KES ${amount(data.mrr)}`} tone="yamabuki" />
        <Stat label="Paying companies" value={paying} tone="wakatake" />
        <Stat label="On free trial" value={trials} tone="ai" />
        <Stat label="Payments to check" value={pending.length} tone="shu" />
      </div>
      <Segmented value={tab} onChange={setTab} className="mb-5" options={[{ value: "payments", label: `Payments${pending.length ? ` (${pending.length})` : ""}` }, { value: "companies", label: `Companies (${data.orgs.length})` }]} />
      {tab === "payments" ? (
        data.payments.length === 0 ? (
          <Panel><Empty title="No payments yet" /></Panel>
        ) : (
          <Panel>
            <Table>
              <thead><tr><Th>Received</Th><Th>Company</Th><Th>Plan</Th><Th>Method</Th><Th>Reference</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th /></tr></thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="num whitespace-nowrap">{format(new Date(p.created_at), "d MMM, HH:mm")}</Td>
                    <Td className="font-bold">{p.org_name}</Td>
                    <Td className="capitalize">{p.plan_id} · {p.months === 12 ? "12 mo" : "1 mo"}</Td>
                    <Td>{p.method === "mpesa_stk" ? "M-Pesa prompt" : p.method === "mpesa_manual" ? "Paybill" : "Bank"}</Td>
                    <Td className="num">{p.reference ?? p.phone ?? "—"}</Td>
                    <Td className="num text-right font-bold">KES {amount(p.amount)}</Td>
                    <Td><Status status={p.status === "confirmed" ? "confirmed_payment" : p.status} /></Td>
                    <Td className="text-right whitespace-nowrap">
                      {p.status === "pending" && p.method !== "mpesa_stk" && (
                        <span className="inline-flex gap-1.5">
                          <Button size="sm" onClick={() => act(() => settle({ data: { paymentId: p.id, action: "confirm" } }), "Confirmed. Plan is active.")}>Confirm</Button>
                          <Button size="sm" variant="danger" onClick={() => act(() => settle({ data: { paymentId: p.id, action: "reject" } }), "Rejected.")}>Reject</Button>
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        )
      ) : (
        <Panel>
          <Table>
            <thead><tr><Th>Company</Th><Th>Owner</Th><Th>Plan</Th><Th>Status</Th><Th className="text-right">Resellers</Th><Th className="text-right">Sales, 30d</Th><Th /></tr></thead>
            <tbody>
              {data.orgs.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <span className="block font-bold">{o.name}</span>
                    <span className="block text-[12px] text-ink-3">{o.industry} · since {shortDate(o.created_at)}</span>
                  </Td>
                  <Td>
                    <span className="block">{o.owner}</span>
                    <span className="block text-[12px] text-ink-3">{o.owner_email}</span>
                  </Td>
                  <Td className="capitalize">{o.plan_id}</Td>
                  <Td>
                    <Status status={o.access.reason === "active" ? "active" : o.access.reason === "trial" ? "trialing" : "past_due"} />
                    {o.access.until && <span className="block text-[12px] text-ink-3">until {shortDate(o.access.until)}</span>}
                  </Td>
                  <Td className="num text-right">{o.resellers}</Td>
                  <Td className="num text-right">{money(o.sales30)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => act(() => extend({ data: { orgId: o.id, days: 14 } }), "Trial extended by 14 days.")}>+14 days trial</Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
