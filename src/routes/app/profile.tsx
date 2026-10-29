import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { changeMyPassword, updateMyProfile } from "@/lib/api/auth.functions";
import { useActive } from "@/lib/viewer";
import { Button, Field, Input, PageTitle, Panel, PasswordInput } from "@/components/kit";

export const Route = createFileRoute("/app/profile")({ component: Profile });

function Profile() {
  const { viewer } = useActive();
  const upd = useServerFn(updateMyProfile);
  const pwFn = useServerFn(changeMyPassword);
  const qc = useQueryClient();
  const [d, setD] = useState({ name: "", phone: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState<"d" | "p" | null>(null);
  useEffect(() => {
    if (viewer) setD({ name: viewer.user.name, phone: viewer.user.phone ?? "" });
  }, [viewer?.user.id]);
  if (!viewer) return null;
  return (
    <>
      <PageTitle title="Your profile" jp="プロフィール" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <h2 className="mb-5 text-lg font-bold">Details</h2>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("d");
              try {
                await upd({ data: d });
                toast.success("Saved.");
                qc.invalidateQueries({ queryKey: ["viewer"] });
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            <Field label="Email"><Input value={viewer.user.email} disabled /></Field>
            <Field label="Full name" htmlFor="pn"><Input id="pn" required value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
            <Field label="Phone" htmlFor="pp"><Input id="pp" required inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} className="num" /></Field>
            <Button type="submit" loading={busy === "d"}>Save details</Button>
          </form>
        </Panel>
        <Panel className="p-5 md:p-6">
          <h2 className="mb-5 text-lg font-bold">Password</h2>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("p");
              try {
                await pwFn({ data: pw });
                toast.success("Password changed. Other devices were signed out.");
                setPw({ current: "", next: "" });
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                setBusy(null);
              }
            }}
          >
            <Field label="Current password" htmlFor="pc"><PasswordInput id="pc" required autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password" htmlFor="pnw" hint="At least 8 characters."><PasswordInput id="pnw" required minLength={8} autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Button type="submit" variant="outline" loading={busy === "p"}>Change password</Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
