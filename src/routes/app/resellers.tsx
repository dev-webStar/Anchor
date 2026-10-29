import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addMember, listResellers, removeMember, resetMemberPassword, rotateJoinCode, saveTiers, updateReseller } from "@/lib/api/org.functions";
import { money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Dialog, Empty, Field, Input, Loading, PageTitle, Panel, Segmented, Select, Status, Table, Td, Th } from "@/components/kit";
import { CopyButton, useOrigin } from "@/components/bits";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/resellers")({ component: Resellers });

type Data = Awaited<ReturnType<typeof listResellers>>;
type Person = Data["people"][number];

function Resellers() {
  const { currency, isOwner } = useActive();
  const fn = useServerFn(listResellers);
  const update = useServerFn(updateReseller);
  const qc = useQueryClient();
  const origin = useOrigin();
  const { data, isLoading } = useQuery({ queryKey: ["resellers"], queryFn: () => fn() });
  const [tab, setTab] = useState<"resellers" | "staff">("resellers");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);
  const [tiers, setTiers] = useState(false);

  const people = useMemo(() => {
    const n = q.toLowerCase();
    return (data?.people ?? []).filter(
      (p) => (tab === "resellers" ? p.role === "reseller" : p.role !== "reseller") && (!q || p.name.toLowerCase().includes(n) || p.email.toLowerCase().includes(n) || p.region?.toLowerCase().includes(n) || p.code.toLowerCase().includes(n)),
    );
  }, [data, q, tab]);

  if (isLoading || !data) return <Loading />;
  const joinUrl = `${origin}/join/${data.joinCode}`;
  const refresh = () => qc.invalidateQueries({ queryKey: ["resellers"] });

  async function quick(p: Person, patch: Parameters<typeof update>[0]["data"], msg: string) {
    try {
      await update({ data: patch });
      toast.success(msg);
      refresh();
      qc.invalidateQueries({ queryKey: ["overview"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle
        title="Resellers"
        jp="販売員"
        actions={
          <>
            {isOwner && <Button variant="outline" size="sm" onClick={() => setTiers(true)}>Commission tiers</Button>}
            {isOwner && <Button size="sm" onClick={() => setAdding(true)}>Add someone</Button>}
          </>
        }
      >
        Approve new sellers, set their tier, and see what each one has sold and earned.
      </PageTitle>

      <Panel className="mb-8 flex flex-wrap items-center gap-3 p-4 md:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-ink-2">Join link · anyone with it can apply to sell for you</p>
          <p className="num truncate text-[17px] font-bold">{joinUrl.replace(/^https?:\/\//, "")}</p>
        </div>
        <CopyButton value={joinUrl} label="Copy join link" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Sell with us and earn commission on every sale. Join here: ${joinUrl}`)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 items-center rounded-[8px] bg-wakatake px-4 font-bold text-paper"
        >
          Share on WhatsApp
        </a>
        {isOwner && <NewLinkButton onDone={refresh} />}
      </Panel>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: "resellers", label: "Resellers" }, { value: "staff", label: "Owner & staff" }]} />
        <Input placeholder="Name, email, area or code" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {people.length === 0 ? (
        <Panel>
          <Empty title={tab === "resellers" ? "No resellers yet" : "No one matches"}>{tab === "resellers" ? "Share your join link. New sign-ups wait here for your approval." : "Try another search."}</Empty>
        </Panel>
      ) : (
        <Panel>
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Area</Th>
                {tab === "resellers" && <Th>Tier</Th>}
                {tab === "resellers" && <Th className="text-right">Sales</Th>}
                {tab === "resellers" && <Th className="text-right">Unpaid earnings</Th>}
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className={cn(p.status === "pending" && "bg-yamabuki-soft/35")}>
                  <Td className="max-w-[260px]">
                    <span className="block truncate font-bold">{p.name}</span>
                    <span className="block truncate text-[13px] text-ink-2">
                      {p.role === "reseller" ? <span className="num">{p.code}</span> : p.role === "owner" ? "Owner" : "Manager"} · {p.phone ?? p.email}
                    </span>
                  </Td>
                  <Td className="text-ink-2">{p.region ?? "—"}</Td>
                  {tab === "resellers" && (
                    <Td>
                      {p.commission_override != null ? <span className="num font-bold">{p.commission_override}% own rate</span> : p.tier_name ? <span>{p.tier_name} <span className="num text-ink-2">· {p.tier_rate}%</span></span> : <span className="num text-ink-2">{data.defaultCommission}% default</span>}
                    </Td>
                  )}
                  {tab === "resellers" && (
                    <Td className="num text-right">
                      <span className="block font-bold">{money(p.sales, currency)}</span>
                      <span className="block text-[12px] text-ink-3">{p.orders} orders</span>
                    </Td>
                  )}
                  {tab === "resellers" && <Td className="num text-right font-bold">{money(Math.max(0, p.earned - p.paid), currency)}</Td>}
                  <Td><Status status={p.status} /></Td>
                  <Td className="text-right whitespace-nowrap">
                    {p.role !== "owner" && (
                      <span className="inline-flex gap-1.5">
                        {p.status === "pending" && <Button size="sm" onClick={() => quick(p, { membershipId: p.id, status: "active" }, `${p.name} can now sell.`)}>Approve</Button>}
                        <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Manage</Button>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <ManageDialog person={editing} tiers={data.tiers} onClose={() => setEditing(null)} onSaved={refresh} />
      <AddDialog open={adding} onOpenChange={setAdding} onSaved={refresh} />
      <TiersDialog open={tiers} onOpenChange={setTiers} tiers={data.tiers} defaultCommission={data.defaultCommission} onSaved={refresh} />
    </>
  );
}

function NewLinkButton({ onDone }: { onDone: () => void }) {
  const fn = useServerFn(rotateJoinCode);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!confirm("Make a new join link? The old one stops working.")) return;
        await fn();
        toast.success("New join link ready.");
        onDone();
      }}
    >
      New link
    </Button>
  );
}

function ManageDialog({ person, tiers, onClose, onSaved }: { person: Person | null; tiers: Data["tiers"]; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(updateReseller);
  const reset = useServerFn(resetMemberPassword);
  const remove = useServerFn(removeMember);
  const [tierId, setTierId] = useState<string>("");
  const [override, setOverride] = useState("");
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  const p = person;
  const reseller = p?.role === "reseller";
  useEffect(() => {
    if (p) {
      setTierId(p.tier_id ?? "");
      setOverride(p.commission_override?.toString() ?? "");
      setRegion(p.region ?? "");
      setTemp(null);
    }
  }, [p]);

  return (
    <Dialog
      open={!!p}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={p?.name ?? ""}
      description={p ? `${p.email}${p.phone ? ` · ${p.phone}` : ""}` : undefined}
    >
      {p && (
        <div className="space-y-6">
          {reseller && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await update({ data: { membershipId: p.id, tierId: tierId || null, commissionOverride: override === "" ? null : Number(override), region: region || null } });
                  toast.success("Saved.");
                  onSaved();
                  onClose();
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Tier" htmlFor="tier">
                <Select id="tier" value={tierId} onChange={(e) => setTierId(e.target.value)}>
                  <option value="">No tier (company default)</option>
                  {tiers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.commission_rate}%</option>)}
                </Select>
              </Field>
              <Field label="Personal rate (%)" htmlFor="ov" hint="Optional. Beats the tier for this person. Product rates still come first.">
                <Input id="ov" inputMode="decimal" value={override} onChange={(e) => setOverride(e.target.value)} className="num" />
              </Field>
              <Field label="Area" htmlFor="rg"><Input id="rg" value={region} onChange={(e) => setRegion(e.target.value)} /></Field>
              {p.payout_details && <p className="text-[14px] text-ink-2">Payout details: <b className="text-ink">{p.payout_method === "bank" ? "Bank" : "M-Pesa"} · {p.payout_details}</b></p>}
              <Button type="submit" loading={busy} className="w-full">Save</Button>
            </form>
          )}
          <div className="space-y-2 border-t border-rule-2 pt-5">
            <p className="font-bold">Access</p>
            {temp ? (
              <div className="rounded-[10px] border border-rule bg-paper p-4">
                <p className="text-[14px] text-ink-2">New password for {p.name}. Share it privately; they can change it from their profile.</p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="num flex-1 text-[22px] font-black tracking-wider">{temp}</p>
                  <CopyButton value={temp} label="Copy password" small />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const r = await reset({ data: { membershipId: p.id } });
                      setTemp(r.password);
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Set a new password
                </Button>
                {p.status === "active" ? (
                  <Button size="sm" variant="outline" onClick={async () => { try { await update({ data: { membershipId: p.id, status: "suspended" } }); toast.success("On hold. They can't sell until released."); onSaved(); onClose(); } catch (e) { toast.error((e as Error).message); } }}>
                    Put on hold
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={async () => { try { await update({ data: { membershipId: p.id, status: "active" } }); toast.success("Active."); onSaved(); onClose(); } catch (e) { toast.error((e as Error).message); } }}>
                    {p.status === "pending" ? "Approve" : "Release hold"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={async () => {
                    if (!confirm(`Remove ${p.name} from your company? Their past orders stay in your records.`)) return;
                    try {
                      await remove({ data: { membershipId: p.id } });
                      toast.success("Removed.");
                      onSaved();
                      onClose();
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function AddDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const fn = useServerFn(addMember);
  const blank = { role: "reseller" as "reseller" | "manager", name: "", email: "", phone: "", region: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null | undefined>(undefined);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setF(blank);
          setTemp(undefined);
        }
      }}
      title="Add someone"
      description="For people who won't use the join link. They're active straight away."
    >
      {temp !== undefined ? (
        <div className="space-y-4">
          {temp ? (
            <div className="rounded-[10px] border border-rule bg-paper p-4">
              <p className="text-[14px] text-ink-2">{f.name} can sign in with {f.email} and this starter password:</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="num flex-1 text-[22px] font-black tracking-wider">{temp}</p>
                <CopyButton value={temp} label="Copy password" small />
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-ink-2">{f.name} already has an Anchor login, so they can sign in with their usual password.</p>
          )}
          <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fn({ data: { ...f, region: f.region || undefined } });
              setTemp(r.tempPassword);
              onSaved();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Segmented value={f.role} onChange={(v) => setF({ ...f, role: v })} options={[{ value: "reseller", label: "Reseller" }, { value: "manager", label: "Manager (staff)" }]} />
          <Field label="Full name" htmlFor="an"><Input id="an" required value={f.name} onChange={set("name")} /></Field>
          <Field label="Phone" htmlFor="ap"><Input id="ap" required inputMode="tel" value={f.phone} onChange={set("phone")} className="num" /></Field>
          <Field label="Email" htmlFor="ae"><Input id="ae" type="email" required value={f.email} onChange={set("email")} /></Field>
          {f.role === "reseller" && <Field label="Area" htmlFor="ar" hint="Optional."><Input id="ar" value={f.region} onChange={set("region")} /></Field>}
          <Button type="submit" className="w-full" loading={busy}>Add {f.role === "reseller" ? "reseller" : "manager"}</Button>
        </form>
      )}
    </Dialog>
  );
}

function TiersDialog({ open, onOpenChange, tiers, defaultCommission, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; tiers: Data["tiers"]; defaultCommission: number; onSaved: () => void }) {
  const fn = useServerFn(saveTiers);
  const [rows, setRows] = useState(tiers.map((t) => ({ id: t.id as string | undefined, name: t.name, rate: String(t.commission_rate) })));
  const [def, setDef] = useState(String(defaultCommission));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setRows(tiers.map((t) => ({ id: t.id as string | undefined, name: t.name, rate: String(t.commission_rate) })));
      setDef(String(defaultCommission));
    }
  }, [open, tiers, defaultCommission]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Commission tiers"
      description="Rates are a percentage of each fulfilled sale. A product's own rate always wins."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await fn({ data: { defaultCommission: Number(def), tiers: rows.filter((r) => r.name.trim()).map((r) => ({ id: r.id, name: r.name, commission_rate: Number(r.rate) })) } });
            toast.success("Tiers saved.");
            onSaved();
            onOpenChange(false);
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Company default (%)" htmlFor="def" hint="For resellers without a tier.">
          <Input id="def" inputMode="decimal" value={def} onChange={(e) => setDef(e.target.value)} className="num w-32" />
        </Field>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input aria-label="Tier name" value={r.name} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <Input aria-label="Rate" inputMode="decimal" value={r.rate} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, rate: e.target.value } : x)))} className="num w-24 text-right" />
              <span className="text-ink-2">%</span>
              <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))} className="px-2 text-sm font-bold text-ink-3 hover:text-shu">Remove</button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setRows([...rows, { id: undefined, name: "", rate: "10" }])}>Add a tier</Button>
        </div>
        <Button type="submit" className="w-full" loading={busy}>Save tiers</Button>
      </form>
    </Dialog>
  );
}
