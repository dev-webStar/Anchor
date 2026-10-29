import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { saveCompany } from "@/lib/api/org.functions";
import { useActive } from "@/lib/viewer";
import { Button, Empty, Field, Input, PageTitle, Panel, Select, Textarea } from "@/components/kit";

export const Route = createFileRoute("/app/settings")({ component: Settings });

const CURRENCIES = ["KES", "UGX", "TZS", "RWF", "GHS", "NGN", "ZAR", "USD"] as const;

function Settings() {
  const { org, isOwner } = useActive();
  const save = useServerFn(saveCompany);
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", industry: "", welcome: "", contactPhone: "", currency: "KES" as (typeof CURRENCIES)[number] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (org) setF({ name: org.name, industry: org.industry, welcome: org.welcome ?? "", contactPhone: org.contact_phone ?? "", currency: org.currency as (typeof CURRENCIES)[number] });
  }, [org?.id]);
  if (!isOwner) return <Empty title="Only the owner can change company settings" />;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageTitle title="Settings" jp="設定" />
      <Panel className="max-w-2xl p-5 md:p-6">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await save({ data: { ...f, welcome: f.welcome || null, contactPhone: f.contactPhone || null } });
              toast.success("Company saved.");
              qc.invalidateQueries({ queryKey: ["viewer"] });
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Company name" htmlFor="cn"><Input id="cn" required value={f.name} onChange={set("name")} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Industry" htmlFor="ci"><Input id="ci" required value={f.industry} onChange={set("industry")} /></Field>
            <Field label="Currency" htmlFor="cc" hint="Used for prices, commissions and payouts.">
              <Select id="cc" value={f.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
          </div>
          <Field label="Contact phone" htmlFor="cp"><Input id="cp" inputMode="tel" value={f.contactPhone} onChange={set("contactPhone")} className="num" /></Field>
          <Field label="Welcome message" htmlFor="cw" hint="Shown on your join page and on resellers' store pages.">
            <Textarea id="cw" maxLength={300} value={f.welcome} onChange={set("welcome")} />
          </Field>
          <Button type="submit" loading={busy}>Save company</Button>
        </form>
      </Panel>
    </>
  );
}
