import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { amount, money, round2 } from "@/lib/format";
import { lineColors } from "@/lib/lines";
import { Segmented } from "@/components/kit";

export type MachineProduct = {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  stock: number | null;
  description?: string | null;
  earn?: number;
};

export type Cart = Record<string, number>;

/**
 * The ticket machine (券売機): one coloured line per category, one paper key per product.
 * Pressing a key adds one to the order.
 */
export function ProductMachine({
  products,
  cart,
  onChange,
  currency,
  disabled,
}: {
  products: MachineProduct[];
  cart: Cart;
  onChange: (c: Cart) => void;
  currency: string;
  disabled?: boolean;
}) {
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products]);
  const color = useMemo(() => lineColors(categories), [categories]);
  const [cat, setCat] = useState<string>("all");
  const list = cat === "all" ? products : products.filter((p) => p.category === cat);

  return (
    <section aria-label="Products" className="overflow-hidden rounded-[18px] border border-rule-2 bg-paper">
      {categories.length > 1 && (
        <div className="overflow-x-auto border-b border-rule px-4 py-3.5 md:px-5">
          <Segmented
            value={cat}
            onChange={setCat}
            options={[
              { value: "all", label: "Everything" },
              ...categories.map((c) => ({
                value: c,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-3 w-1.5 rounded-full", color(c).band)} />
                    {c}
                  </span>
                ),
              })),
            ]}
          />
        </div>
      )}
      <div className="bg-stone-2/55 p-3 shadow-[inset_0_2px_6px_rgb(0_0_0/0.06)] md:p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 md:gap-3">
          {list.map((p) => {
            const inCart = cart[p.id] ?? 0;
            const out = p.stock != null && p.stock <= inCart;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled || out}
                onClick={() => onChange({ ...cart, [p.id]: inCart + 1 })}
                className={cn(
                  "machine-key group flex min-h-[132px] flex-col overflow-hidden text-left",
                  "hover:border-ink-3 active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:active:translate-y-0",
                  inCart > 0 && "border-ink",
                )}
              >
                <span className={cn("h-[5px] w-full shrink-0", color(p.category).band)} />
                <span className="flex flex-1 flex-col px-3.5 pt-3 pb-3">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[16px] leading-tight font-black md:text-[17px]">{p.name}</span>
                    {inCart > 0 && <span className="num grid size-6 shrink-0 animate-pop place-items-center rounded-full bg-ink text-[12px] font-bold text-paper">{inCart}</span>}
                  </span>
                  <span className="mt-1 text-[13px] text-ink-2">
                    per {p.unit}
                    {p.stock != null && <span className={p.stock < 10 ? "text-shu" : ""}> · {p.stock} left</span>}
                  </span>
                  <span className="mt-auto flex items-baseline justify-between gap-2 pt-3">
                    <span className="flex items-baseline gap-1">
                      <span className="text-[11px] font-bold text-ink-2">{currency}</span>
                      <span className="num text-[19px] leading-none font-bold">{amount(p.price)}</span>
                    </span>
                    {p.earn != null && p.earn > 0 && <span className="num text-[12px] font-bold text-wakatake">+{amount(p.earn)}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {list.length === 0 && <p className="px-1 py-8 text-center text-sm text-ink-2">No products here yet.</p>}
      </div>
    </section>
  );
}

/** The order slip: what's picked, quantities, and totals. */
export function OrderSlip({ products, cart, onChange, currency, showEarn }: { products: MachineProduct[]; cart: Cart; onChange: (c: Cart) => void; currency: string; showEarn?: boolean }) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ p: byId.get(id)!, qty }))
    .filter((l) => l.p);
  const total = round2(lines.reduce((s, l) => s + l.p.price * l.qty, 0));
  const earn = round2(lines.reduce((s, l) => s + (l.p.earn ?? 0) * l.qty, 0));

  const set = (id: string, qty: number) => {
    const next = { ...cart };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    onChange(next);
  };

  if (lines.length === 0) return <p className="py-6 text-center text-[15px] text-ink-2">Press a product to add it to this order.</p>;

  return (
    <div>
      <ul className="divide-y divide-dashed divide-rule-2">
        {lines.map(({ p, qty }) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{p.name}</p>
              <p className="num text-[13px] text-ink-2">
                {money(p.price, currency)} × {qty}
              </p>
            </div>
            <div className="flex items-center rounded-[8px] border border-rule-2 bg-paper">
              <button type="button" onClick={() => set(p.id, qty - 1)} className="grid size-9 place-items-center text-ink-2 hover:text-ink" aria-label={`One less ${p.name}`}>
                <Minus className="size-4" />
              </button>
              <span className="num w-7 text-center font-bold">{qty}</span>
              <button
                type="button"
                disabled={p.stock != null && qty >= p.stock}
                onClick={() => set(p.id, qty + 1)}
                className="grid size-9 place-items-center text-ink-2 hover:text-ink disabled:opacity-40"
                aria-label={`One more ${p.name}`}
              >
                <Plus className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <dl className="mt-2 space-y-1.5 border-t-2 border-ink pt-3">
        <div className="flex justify-between text-[17px]">
          <dt className="font-bold">Total</dt>
          <dd className="num font-black">{money(total, currency)}</dd>
        </div>
        {showEarn && earn > 0 && (
          <div className="flex justify-between text-[15px]">
            <dt className="text-ink-2">You earn when fulfilled</dt>
            <dd className="num font-bold text-wakatake">+{money(earn, currency)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
