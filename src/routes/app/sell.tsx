import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getSellCatalog, placeSale } from "@/lib/api/seller.functions";
import { money } from "@/lib/format";
import { useActive } from "@/lib/viewer";
import { Button, Empty, Field, Input, Loading, PageTitle, Panel, Textarea } from "@/components/kit";
import { OrderSlip, ProductMachine, type Cart } from "@/components/machine";

export const Route = createFileRoute("/app/sell")({ component: Sell });

function Sell() {
  const { access, member, isManager, currency } = useActive();
  const fn = useServerFn(getSellCatalog);
  const place = useServerFn(placeSale);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["sell-catalog"], queryFn: () => fn() });
  const [cart, setCart] = useState<Cart>({});
  const [customer, setCustomer] = useState({ name: "", phone: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ref: string; total: number; commission: number } | null>(null);

  if (isLoading || !data) return <Loading />;
  const blocked = !access?.open || member?.status !== "active";
  const count = Object.values(cart).reduce((s, q) => s + q, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await place({
        data: {
          customerName: customer.name,
          customerPhone: customer.phone || undefined,
          note: customer.note || undefined,
          items: Object.entries(cart).map(([productId, qty]) => ({ productId, qty })),
        },
      });
      setDone(r);
      setCart({});
      setCustomer({ name: "", phone: "", note: "" });
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (data.products.length === 0)
    return (
      <>
        <PageTitle title={isManager ? "New order" : "Sell"} jp="販売" />
        <Empty title="No products yet" action={isManager && <Link to="/app/products" className="inline-flex h-11 items-center rounded-[8px] bg-ink px-5 font-bold text-paper">Add products</Link>}>
          {isManager ? "Add what you sell, and it shows up here as keys to press." : "The company hasn't added products yet."}
        </Empty>
      </>
    );

  return (
    <>
      <PageTitle title={isManager ? "New order" : "Sell"} jp="販売">
        {isManager ? "Record an order taken at the office. It isn't linked to a reseller." : "Press products to build the order, then add the customer's details."}
      </PageTitle>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <ProductMachine products={data.products} cart={cart} onChange={setCart} currency={currency} disabled={blocked} />
        <Panel className="lg:sticky lg:top-8">
          <div className="border-b border-rule px-5 py-4">
            <p className="font-mincho text-[20px] font-extrabold">Order slip</p>
            <p className="text-[13px] text-ink-2">{count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}</p>
          </div>
          <div className="px-5 pb-5">
            {done ? (
              <div className="py-5">
                <div className="ticket animate-print bg-stone/80 px-5 py-4">
                  <p className="text-[13px] text-ink-2">Order saved</p>
                  <p className="num text-[22px] font-black tracking-wider">{done.ref}</p>
                  <p className="num mt-1 text-[15px]">
                    {money(done.total, currency)}
                    {done.commission > 0 && <span className="font-bold text-wakatake"> · you earn {money(done.commission, currency)}</span>}
                  </p>
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={() => setDone(null)}>Start another order</Button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <OrderSlip products={data.products} cart={cart} onChange={setCart} currency={currency} showEarn={!isManager} />
                {count > 0 && (
                  <div className="mt-5 space-y-3">
                    <Field label="Customer name" htmlFor="cn">
                      <Input id="cn" required value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
                    </Field>
                    <Field label="Customer phone" htmlFor="cp" hint="Optional.">
                      <Input id="cp" inputMode="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="num" />
                    </Field>
                    <Field label="Note" htmlFor="nt" hint="Delivery place, size, anything the office should know.">
                      <Textarea id="nt" className="min-h-16" value={customer.note} onChange={(e) => setCustomer({ ...customer, note: e.target.value })} />
                    </Field>
                    <Button type="submit" variant="yamabuki" size="lg" className="w-full" loading={busy} disabled={blocked}>
                      Save order
                    </Button>
                  </div>
                )}
              </form>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
