import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getStorefront, placeStorefrontOrder } from "@/lib/api/seller.functions";
import { money } from "@/lib/format";
import { Button, Empty, Field, Hanko, Input, Loading, Panel, Textarea } from "@/components/kit";
import { OrderSlip, ProductMachine, type Cart } from "@/components/machine";

export const Route = createFileRoute("/s/$org/$code")({ ssr: false, component: Store });

function Store() {
  const { org, code } = Route.useParams();
  const fn = useServerFn(getStorefront);
  const place = useServerFn(placeStorefrontOrder);
  const { data, isLoading } = useQuery({ queryKey: ["store", org, code], queryFn: () => fn({ data: { org, code } }) });
  const [cart, setCart] = useState<Cart>({});
  const [c, setC] = useState({ name: "", phone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; total: number } | null>(null);

  if (isLoading) return <Loading label="Opening the store" />;
  if (!data) return <Empty title="Store not found">Check the link with the person who sent it.</Empty>;
  const cur = data.company.currency;
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  const waPhone = data.seller.phone?.replace(/\D/g, "").replace(/^0/, "254");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-5 md:px-8">
        <span className="flex min-w-0 items-center gap-3">
          <Hanko name={data.company.name} size={40} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-mincho text-[17px] font-extrabold">{data.company.name}</span>
            <span className="block text-[12px] text-ink-2">{data.company.industry}</span>
          </span>
        </span>
        {waPhone && (
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="inline-flex h-9 shrink-0 items-center rounded-[7px] bg-wakatake px-3.5 text-sm font-bold text-paper">
            WhatsApp {data.seller.name.split(" ")[0]}
          </a>
        )}
      </header>

      <section className="mx-auto max-w-[1100px] px-4 pt-4 pb-8 md:px-8 md:pt-10">
        <p className="text-[15px] font-bold text-ink-2">
          Your seller: {data.seller.name}
          {data.seller.region ? ` · ${data.seller.region}` : ""}
        </p>
        <h1 className="mt-2 max-w-[20ch] font-mincho text-[38px] leading-[1.08] font-extrabold tracking-[-0.02em] md:text-[56px]">Order from {data.company.name}</h1>
        <p className="mt-3 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
          {data.company.welcome || "Pick what you'd like, leave your phone number, and your seller will confirm the order and how to pay."}
        </p>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-20 md:px-8">
        {!data.open ? (
          <Panel><Empty title="Orders are paused">This store isn't taking orders right now. Message your seller on WhatsApp.</Empty></Panel>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
            <ProductMachine products={data.products} cart={cart} onChange={setCart} currency={cur} />
            <Panel className="lg:sticky lg:top-8">
              <div className="border-b border-rule px-5 py-4">
                <p className="font-mincho text-[20px] font-extrabold">Your order</p>
                <p className="text-[13px] text-ink-2">{count === 0 ? "Nothing yet" : `${count} ${count === 1 ? "item" : "items"}`}</p>
              </div>
              <div className="px-5 pb-5">
                {done ? (
                  <div className="py-5">
                    <div className="ticket animate-print bg-stone/80 px-5 py-4">
                      <p className="text-[13px] text-ink-2">Order sent</p>
                      <p className="num text-[22px] font-black tracking-wider">{done.ref}</p>
                      <p className="num mt-1 text-[15px]">{money(done.total, cur)}</p>
                    </div>
                    <p className="mt-4 text-[15px] text-ink-2">{data.seller.name.split(" ")[0]} will call or message you to confirm and arrange payment.</p>
                    <Button variant="outline" className="mt-4 w-full" onClick={() => setDone(null)}>Order something else</Button>
                  </div>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setBusy(true);
                      try {
                        const r = await place({ data: { org, code, customerName: c.name, customerPhone: c.phone, note: c.note || undefined, items: Object.entries(cart).map(([productId, qty]) => ({ productId, qty })) } });
                        setDone(r);
                        setCart({});
                      } catch (err) {
                        toast.error((err as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <OrderSlip products={data.products} cart={cart} onChange={setCart} currency={cur} />
                    {count > 0 && (
                      <div className="mt-5 space-y-3">
                        <Field label="Your name" htmlFor="n"><Input id="n" required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} autoComplete="name" /></Field>
                        <Field label="Phone" htmlFor="p" hint="Your seller uses it to confirm the order."><Input id="p" required inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} className="num" autoComplete="tel" /></Field>
                        <Field label="Note" htmlFor="t" hint="Optional. Delivery place, colour, size…"><Textarea id="t" className="min-h-16" value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} /></Field>
                        <Button type="submit" variant="yamabuki" size="lg" className="w-full" loading={busy}>Send order</Button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </Panel>
          </div>
        )}
      </section>
      <footer className="border-t border-rule-2">
        <p className="mx-auto max-w-[1100px] px-4 py-6 text-sm text-ink-2 md:px-8">
          Runs on <Link to="/" className="font-bold text-ink underline underline-offset-4">Anchor Hub</Link>
        </p>
      </footer>
    </div>
  );
}
