import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { signUpCompany } from "@/lib/api/auth.functions";
import { AuthFrame, FormError } from "@/components/auth";
import { Button, Field, Input, PasswordInput, Select } from "@/components/kit";

export const Route = createFileRoute("/signup")({
  validateSearch: z.object({ plan: z.enum(["starter", "growth", "scale"]).optional() }),
  component: Signup,
});

const INDUSTRIES = ["Beauty & personal care", "FMCG distribution", "Solar & energy", "Insurance", "Agro-inputs", "Fashion & textiles", "Health & pharmacy", "Airtime & data", "Education", "Food & beverage", "Other"];
const PLAN_NAMES = { starter: "Starter", growth: "Growth", scale: "Scale" } as const;

function Signup() {
  const { plan = "growth" } = Route.useSearch();
  const fn = useServerFn(signUpCompany);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ company: "", industry: INDUSTRIES[0], name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError(null);
    try {
      await fn({ data: { ...f, plan } });
      await qc.invalidateQueries({ queryKey: ["viewer"] });
      navigate({ to: "/app" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Start your free trial"
      intro={`14 days of the ${PLAN_NAMES[plan]} plan, free. No card or M-Pesa needed until you decide to stay.`}
      aside={<Link to="/login" className="text-sm font-bold text-ink-2 hover:text-ink">Sign in</Link>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company name" htmlFor="co">
          <Input id="co" required value={f.company} onChange={set("company")} autoComplete="organization" />
        </Field>
        <Field label="Industry" htmlFor="ind">
          <Select id="ind" value={f.industry} onChange={set("industry")}>
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </Select>
        </Field>
        <div className="h-px bg-rule-2" />
        <Field label="Your name" htmlFor="nm">
          <Input id="nm" required value={f.name} onChange={set("name")} autoComplete="name" />
        </Field>
        <Field label="Phone" htmlFor="ph" hint="We'll use it for M-Pesa billing prompts.">
          <Input id="ph" required inputMode="tel" placeholder="0712 345 678" value={f.phone} onChange={set("phone")} autoComplete="tel" className="num" />
        </Field>
        <Field label="Work email" htmlFor="em">
          <Input id="em" type="email" required value={f.email} onChange={set("email")} autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="pw" hint="At least 8 characters.">
          <PasswordInput id="pw" required value={f.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
        <FormError error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create company</Button>
      </form>
    </AuthFrame>
  );
}
