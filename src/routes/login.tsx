import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { signIn } from "@/lib/api/auth.functions";
import { AuthFrame, FormError } from "@/components/auth";
import { Button, Field, Input, PasswordInput } from "@/components/kit";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const fn = useServerFn(signIn);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn({ data: { email, password } });
      await qc.invalidateQueries({ queryKey: ["viewer"] });
      navigate({ to: "/app" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" intro="Sign in to your company or your reseller account." aside={<Link to="/signup" className="text-sm font-bold text-ink-2 hover:text-ink">New company?</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="pw" hint="Forgot it? Ask your company admin to set a new one for you.">
          <PasswordInput id="pw" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError error={error} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <p className="mt-8 text-center text-sm text-ink-2">
        Reselling for a company? Open the join link they sent you.
      </p>
    </AuthFrame>
  );
}
