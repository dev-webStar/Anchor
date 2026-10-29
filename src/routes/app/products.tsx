import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteProduct, listProducts, saveProduct } from "@/lib/api/org.functions";
import { amount } from "@/lib/format";
import { lineColors } from "@/lib/lines";
import { useActive } from "@/lib/viewer";
import { Button, Dialog, Empty, Field, Input, Loading, PageTitle, Panel, SectionHead, Switch, Table, Td, Textarea, Th } from "@/components/kit";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/app/products")({ component: Products });

type P = Awaited<ReturnType<typeof listProducts>>[number];

function Products() {
  const { currency } = useActive();
  const fn = useServerFn(listProducts);
  const save = useServerFn(saveProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: () => fn() });
  const [editing, setEditing] = useState<Partial<P> | null>(null);
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const n = q.toLowerCase();
    const list = (data ?? []).filter((p) => !q || p.name.toLowerCase().includes(n) || p.sku?.toLowerCase().includes(n) || p.category.toLowerCase().includes(n));
    const m = new Map<string, P[]>();
    for (const p of list) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [data, q]);
  const color = useMemo(() => lineColors((data ?? []).map((p) => p.category)), [data]);
  const categories = useMemo(() => Array.from(new Set((data ?? []).map((p) => p.category))), [data]);

  if (isLoading) return <Loading />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  return (
    <>
      <PageTitle title="Products" jp="商品" actions={<Button size="sm" onClick={() => setEditing({ active: true, unit: "item", category: categories[0] ?? "General" })}>Add product</Button>}>
        What your resellers sell. Each category becomes a coloured line on the order screen.
      </PageTitle>
      {!data?.length ? (
        <Panel>
          <Empty title="Add your first product" action={<Button onClick={() => setEditing({ active: true, unit: "item", category: "General" })}>Add product</Button>}>
            Anything with a price works: goods, services, policies, installations.
          </Empty>
        </Panel>
      ) : (
        <>
          <Input placeholder="Search name, SKU or category" value={q} onChange={(e) => setQ(e.target.value)} className="mb-6 max-w-xs" />
          <div className="space-y-10">
            {groups.map(([cat, rows]) => (
              <section key={cat}>
                <SectionHead title={cat} right={<span className="num text-sm text-ink-2">{rows.length}</span>} />
                <Panel>
                  <Table>
                    <thead>
                      <tr><Th>Product</Th><Th className="text-right">Price ({currency})</Th><Th className="text-right">Commission</Th><Th className="text-right">Stock</Th><Th className="text-right">Sold, 30d</Th><Th>For sale</Th><Th /></tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id} className={cn(!p.active && "opacity-55")}>
                          <Td>
                            <span className="flex items-center gap-2.5">
                              <span className={cn("h-7 w-1 shrink-0 rounded-full", color(p.category).band)} />
                              <span className="min-w-0">
                                <span className="block truncate font-bold">{p.name}</span>
                                <span className="block text-[12px] text-ink-3">{p.sku ? `${p.sku} · ` : ""}per {p.unit}</span>
                              </span>
                            </span>
                          </Td>
                          <Td className="num text-right font-bold">{amount(p.price)}</Td>
                          <Td className="num text-right">{p.commission_rate != null ? `${p.commission_rate}%` : <span className="text-ink-3">Seller's rate</span>}</Td>
                          <Td className={cn("num text-right", p.stock != null && p.stock < 10 && "font-bold text-shu")}>{p.stock ?? <span className="text-ink-3">Not tracked</span>}</Td>
                          <Td className="num text-right">{p.sold30}</Td>
                          <Td>
                            <Switch
                              label={`${p.name} for sale`}
                              checked={p.active}
                              onChange={async (v) => {
                                await save({ data: { id: p.id, name: p.name, sku: p.sku, category: p.category, unit: p.unit, price: p.price, commission_rate: p.commission_rate, stock: p.stock, active: v, description: p.description } });
                                refresh();
                              }}
                            />
                          </Td>
                          <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button></Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Panel>
              </section>
            ))}
          </div>
        </>
      )}
      <ProductDialog product={editing} categories={categories} currency={currency} onClose={() => setEditing(null)} onSaved={refresh} />
    </>
  );
}

function ProductDialog({ product, categories, currency, onClose, onSaved }: { product: Partial<P> | null; categories: string[]; currency: string; onClose: () => void; onSaved: () => void }) {
  const save = useServerFn(saveProduct);
  const del = useServerFn(deleteProduct);
  const [f, setF] = useState({ name: "", sku: "", category: "", unit: "", price: "", commission: "", stock: "", description: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (product)
      setF({
        name: product.name ?? "",
        sku: product.sku ?? "",
        category: product.category ?? "",
        unit: product.unit ?? "item",
        price: product.price != null ? String(product.price) : "",
        commission: product.commission_rate != null ? String(product.commission_rate) : "",
        stock: product.stock != null ? String(product.stock) : "",
        description: product.description ?? "",
      });
  }, [product]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()} title={product?.id ? "Edit product" : "Add product"} wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save({
              data: {
                id: product?.id,
                name: f.name,
                sku: f.sku || null,
                category: f.category || "General",
                unit: f.unit || "item",
                price: Number(f.price),
                commission_rate: f.commission === "" ? null : Number(f.commission),
                stock: f.stock === "" ? null : Number(f.stock),
                active: product?.active ?? true,
                description: f.description || null,
              },
            });
            toast.success("Product saved.");
            onSaved();
            onClose();
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name" htmlFor="pn"><Input id="pn" required value={f.name} onChange={set("name")} /></Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Category" htmlFor="pc" hint="Products in the same category share a line.">
            <Input id="pc" list="cats" required value={f.category} onChange={set("category")} />
            <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Sold per" htmlFor="pu" hint="jar, bag, kit, policy, hour…"><Input id="pu" required value={f.unit} onChange={set("unit")} /></Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={`Price (${currency})`} htmlFor="pp"><Input id="pp" required inputMode="decimal" value={f.price} onChange={set("price")} className="num" /></Field>
          <Field label="Commission (%)" htmlFor="pr" hint="Empty: use the seller's rate."><Input id="pr" inputMode="decimal" value={f.commission} onChange={set("commission")} className="num" /></Field>
          <Field label="Stock" htmlFor="ps" hint="Empty: don't track."><Input id="ps" inputMode="numeric" value={f.stock} onChange={set("stock")} className="num" /></Field>
        </div>
        <Field label="SKU or code" htmlFor="pk" hint="Optional."><Input id="pk" value={f.sku} onChange={set("sku")} /></Field>
        <Field label="Description" htmlFor="pd" hint="Optional. Shown on resellers' store pages."><Textarea id="pd" value={f.description} onChange={set("description")} /></Field>
        <div className="flex gap-2">
          <Button type="submit" loading={busy} className="flex-1">Save product</Button>
          {product?.id && (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!confirm("Delete this product? Past orders keep its name and price.")) return;
                await del({ data: { id: product.id! } });
                toast.success("Deleted.");
                onSaved();
                onClose();
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
