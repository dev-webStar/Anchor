import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listPayouts, settlePayout } from "@/lib/api/org.functions";
import { money, shortDate } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Dialog, Empty, Field, Input, Loading, PageTitle, Panel, Segmented, Status, Table, Td, Th } from "@/components/kit";
import { CopyButton } from "@/components/bits";

export const Route = createFileRoute("/app/payouts")({ component: Payouts });

type Row = Awaited<ReturnType<typeof listPayouts>>[number];

function Payouts() {
  const { currency } = useActive();
  const fn = useServerFn(listPayouts);
  const settle = useServerFn(settlePayout);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["payouts"], queryFn: () => fn() });
  const [tab, setTab] = useState<"open" | "done">("open");
  const [paying, setPaying] = useState<Row | null>(null);
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loading />;
  const rows = (data ?? []).filter((r) => (tab === "open" ? r.status === "requested" : r.status !== "requested"));
  const owed = (data ?? []).filter((r) => r.status === "requested").reduce((s, r) => s + r.amount, 0);

  async function reject(r: Row) {
    if (!confirm(`Reject ${r.name}'s request? The amount goes back to their available earnings.`)) return;
    try {
      await settle({ data: { id: r.id, action: "rejected" } });
      toast.success("Rejected.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle title="Payouts" jp="支払">
        Resellers request their earnings here. Send the money by M-Pesa or bank, then record the reference.
      </PageTitle>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "open", label: "To pay" }, { value: "done", label: "History" }]} />
        {owed > 0 && <p className="text-[15px] text-ink-2">Waiting to be paid: <b className="num text-ink">{money(owed, currency)}</b></p>}
      </div>
      {rows.length === 0 ? (
        <Panel><Empty title={tab === "open" ? "Nothing to pay" : "No payouts yet"}>{tab === "open" ? "Requests from resellers will show up here." : "Paid and rejected requests are kept here."}</Empty></Panel>
      ) : (
        <Panel>
          <Table>
            <thead><tr><Th>Requested</Th><Th>Reseller</Th><Th>Send to</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="num whitespace-nowrap">{shortDate(r.created_at)}</Td>
                  <Td>
                    <span className="block font-bold">{r.name}</span>
                    <span className="num block text-[12px] text-ink-3">{r.code}</span>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <span>
                        <span className="block text-[12px] font-bold text-ink-2">{r.method === "mpesa" ? "M-Pesa" : "Bank"}</span>
                        <span className="num block">{r.destination}</span>
                      </span>
                      <CopyButton value={r.destination} label="Copy payout details" small />
                    </span>
                  </Td>
                  <Td className="num text-right text-[17px] font-bold">{money(r.amount, currency)}</Td>
                  <Td>
                    <Status status={r.status} />
                    {r.reference && <span className="num block text-[12px] text-ink-3">{r.reference}</span>}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.status === "requested" && (
                      <span className="inline-flex gap-1.5">
                        <Button size="sm" onClick={() => { setRef(""); setPaying(r); }}>Mark paid</Button>
                        <Button size="sm" variant="danger" onClick={() => reject(r)}>Reject</Button>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)} title="Record payment" description={paying ? `${money(paying.amount, currency)} to ${paying.name}` : undefined}>
        {paying && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await settle({ data: { id: paying.id, action: "paid", reference: ref } });
                toast.success("Payout recorded.");
                setPaying(null);
                qc.invalidateQueries();
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="rounded-[10px] border border-rule bg-paper p-4 text-[15px]">
              Send <b className="num">{money(paying.amount, currency)}</b> by {paying.method === "mpesa" ? "M-Pesa" : "bank"} to <b className="num">{paying.destination}</b>.
            </p>
            <Field label={paying.method === "mpesa" ? "M-Pesa code" : "Bank reference"} htmlFor="ref" hint="From the confirmation message, e.g. SJK4H7Q2LM.">
              <Input id="ref" required value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} className="num tracking-wider" />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>Mark paid</Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
