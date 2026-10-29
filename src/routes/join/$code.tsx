import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getJoinInfo, joinCompany } from "@/lib/api/auth.functions";
import { useViewer } from "@/lib/viewer";
import { AuthFrame, FormError } from "@/components/auth";
import { Button, Empty, Field, Input, Loading, PasswordInput } from "@/components/kit";

export const Route = createFileRoute("/join/$code")({ ssr: false, component: Join });

function Join() {
  const { code } = Route.useParams();
  const infoFn = useServerFn(getJoinInfo);
  const joinFn = useServerFn(joinCompany);
  const viewer = useViewer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["join", code], queryFn: () => infoFn({ data: { code } }) });
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", region: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (info.isLoading || viewer.isLoading) return <Loading />;
  if (!info.data) return <Empty title="This join link doesn't work">Ask the company for a fresh link.</Empty>;

  async function join(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await joinFn({ data: viewer.data ? { code, region: f.region || undefined } : { code, ...f, region: f.region || undefined } });
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
      brand={info.data.name}
      title={`Sell for ${info.data.name}`}
      intro={info.data.welcome || `Join ${info.data.name}'s reseller network. You'll get your own store link and earn commission on every sale.`}
    >
      {viewer.data ? (
        <div className="space-y-4">
          <p className="text-[15px] text-ink-2">
            You're signed in as <b className="text-ink">{viewer.data.user.email}</b>.
          </p>
          <Field label="Your area" htmlFor="rg" hint="Optional. Helps the company group sellers by region.">
            <Input id="rg" value={f.region} onChange={set("region")} placeholder="e.g. Nairobi" />
          </Field>
          <FormError error={error} />
          <Button size="lg" className="w-full" loading={busy} onClick={() => join()}>Join {info.data.name}</Button>
        </div>
      ) : (
        <form onSubmit={join} className="space-y-4">
          <Field label="Full name" htmlFor="nm"><Input id="nm" required value={f.name} onChange={set("name")} autoComplete="name" /></Field>
          <Field label="Phone" htmlFor="ph" hint="Also used for M-Pesa payouts."><Input id="ph" required inputMode="tel" value={f.phone} onChange={set("phone")} className="num" autoComplete="tel" /></Field>
          <Field label="Email" htmlFor="em"><Input id="em" type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></Field>
          <Field label="Your area" htmlFor="rg" hint="Optional. Town or region you sell in."><Input id="rg" value={f.region} onChange={set("region")} /></Field>
          <Field label="Password" htmlFor="pw" hint="At least 8 characters."><PasswordInput id="pw" required value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
          <FormError error={error} />
          <Button type="submit" size="lg" className="w-full" loading={busy}>Join as a reseller</Button>
          <p className="text-center text-sm text-ink-2">
            Already on Anchor Hub? <Link to="/login" className="font-bold text-ink underline underline-offset-4">Sign in</Link>, then open this link again.
          </p>
        </form>
      )}
    </AuthFrame>
  );
}
