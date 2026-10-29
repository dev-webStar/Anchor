import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { deleteAnnouncement, listAnnouncements, postAnnouncement } from "@/lib/api/org.functions";
import { useActive } from "@/lib/viewer";
import { Button, Empty, Field, Input, Loading, PageTitle, Panel, Switch, Textarea } from "@/components/kit";

export const Route = createFileRoute("/app/notices")({ component: Notices });

function Notices() {
  const { isManager } = useActive();
  const fn = useServerFn(listAnnouncements);
  const post = useServerFn(postAnnouncement);
  const del = useServerFn(deleteAnnouncement);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["notices"], queryFn: () => fn() });
  const [f, setF] = useState({ title: "", body: "", pinned: false });
  const [busy, setBusy] = useState(false);

  return (
    <>
      <PageTitle title="Announcements" jp="告知">{isManager ? "Post once and every reseller sees it on their home screen." : "News and changes from the company."}</PageTitle>
      <div className={isManager ? "grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start" : ""}>
        <div>
          {isLoading ? (
            <Loading />
          ) : !data?.length ? (
            <Panel><Empty title="Nothing posted yet">{isManager ? "Start with a welcome note for your sellers." : "Check back later."}</Empty></Panel>
          ) : (
            <div className="space-y-4">
              {data.map((a) => (
                <Panel key={a.id} className="p-5 md:p-6">
                  {a.pinned && (
                    <p className="mb-2 flex items-center gap-2 text-[12px] font-bold text-shu">
                      <span className="size-2 rounded-[2px] bg-shu" /> Pinned
                    </p>
                  )}
                  <p className="font-mincho text-[22px] leading-tight font-extrabold">{a.title}</p>
                  <p className="mt-2 max-w-[68ch] text-[16px] leading-relaxed whitespace-pre-line text-ink-2">{a.body}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[13px] text-ink-3">{a.author ?? "Company"} · {format(new Date(a.created_at), "d MMM yyyy, HH:mm")}</p>
                    {isManager && (
                      <button
                        className="text-[13px] font-bold text-ink-3 hover:text-shu"
                        onClick={async () => {
                          if (!confirm("Delete this announcement?")) return;
                          await del({ data: { id: a.id } });
                          qc.invalidateQueries({ queryKey: ["notices"] });
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
        {isManager && (
          <Panel className="p-5 lg:sticky lg:top-8">
            <p className="mb-4 font-mincho text-[20px] font-extrabold">New announcement</p>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await post({ data: f });
                  toast.success("Posted to your network.");
                  setF({ title: "", body: "", pinned: false });
                  qc.invalidateQueries({ queryKey: ["notices"] });
                  qc.invalidateQueries({ queryKey: ["overview"] });
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Headline" htmlFor="nt"><Input id="nt" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Message" htmlFor="nb"><Textarea id="nb" required className="min-h-32" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
              <label className="flex items-center justify-between gap-3 text-[15px] font-bold">
                Pin to the top
                <Switch label="Pin" checked={f.pinned} onChange={(v) => setF({ ...f, pinned: v })} />
              </label>
              <Button type="submit" className="w-full" loading={busy}>Post</Button>
            </form>
          </Panel>
        )}
      </div>
    </>
  );
}
