import type postgres from "postgres";
import { hashPassword } from "./auth.server";

/*
  Demo data for local development. Runs only when the database has no users.
  Sign in with:
    owner@savanna.test   / anchor-demo     (company owner)
    wanjiku@savanna.test / anchor-demo     (reseller)
    admin@anchor.test    / anchor-admin    (Anchor staff)
*/
export async function seedDemo(db: ReturnType<typeof postgres>) {
  const [{ n }] = await db<{ n: string }[]>`select count(*) as n from users`;
  if (Number(n) > 0) return;

  const pw = await hashPassword("anchor-demo");
  const adminPw = await hashPassword("anchor-admin");

  await db.begin(async (tx) => {
    await tx`insert into users (email, name, phone, password_hash, is_platform_admin) values ('admin@anchor.test', 'Anchor Admin', '0700000000', ${adminPw}, true)`;
    const [owner] = await tx<{ id: string }[]>`insert into users (email, name, phone, password_hash) values ('owner@savanna.test', 'Achieng Odhiambo', '0712345678', ${pw}) returning id`;
    const [org] = await tx<{ id: string }[]>`
      insert into orgs (name, slug, industry, plan_id, status, trial_ends_at, join_code, default_commission, welcome, contact_phone)
      values ('Savanna Naturals', 'savanna-naturals', 'Beauty & personal care', 'growth', 'trialing', now() + interval '9 days', 'SAVANNA8',
        10, 'Shea butter, black soap and oils made in Nakuru. Order through your local Savanna seller.', '0712345678') returning id`;
    const tiers = await tx<{ id: string; name: string }[]>`
      insert into tiers (org_id, name, commission_rate, sort) values (${org.id}, 'Bronze', 8, 1), (${org.id}, 'Silver', 10, 2), (${org.id}, 'Gold', 12.5, 3) returning id, name`;
    const tier = Object.fromEntries(tiers.map((t) => [t.name, t.id]));
    await tx`insert into memberships (org_id, user_id, role, code) values (${org.id}, ${owner.id}, 'owner', 'OWNER')`;

    const sellers: [string, string, string, string, string, string][] = [
      ["Wanjiku Kamau", "wanjiku@savanna.test", "0722111222", "WANJ7K", "Gold", "Nairobi"],
      ["Brian Otieno", "brian@savanna.test", "0733222333", "BRIA4P", "Silver", "Kisumu"],
      ["Fatuma Hassan", "fatuma@savanna.test", "0744333444", "FATU9M", "Silver", "Mombasa"],
      ["Kevin Mutua", "kevin@savanna.test", "0755444555", "KEVI2R", "Bronze", "Machakos"],
      ["Grace Njeri", "grace@savanna.test", "0766555666", "GRAC6T", "Bronze", "Nakuru"],
      ["Peter Kiprop", "peter@savanna.test", "0777666777", "PETE3W", "Bronze", "Eldoret"],
    ];
    const memberIds: string[] = [];
    for (const [name, email, phone, c, t, region] of sellers) {
      const [u] = await tx<{ id: string }[]>`insert into users (email, name, phone, password_hash) values (${email}, ${name}, ${phone}, ${pw}) returning id`;
      const [m] = await tx<{ id: string }[]>`
        insert into memberships (org_id, user_id, role, status, code, tier_id, region, payout_method, payout_details)
        values (${org.id}, ${u.id}, 'reseller', 'active', ${c}, ${tier[t]}, ${region}, 'mpesa', ${phone}) returning id`;
      memberIds.push(m.id);
    }
    const [pend] = await tx<{ id: string }[]>`insert into users (email, name, phone, password_hash) values ('mercy@savanna.test', 'Mercy Atieno', '0788777888', ${pw}) returning id`;
    await tx`insert into memberships (org_id, user_id, role, status, code, tier_id, region) values (${org.id}, ${pend.id}, 'reseller', 'pending', 'MERC5H', ${tier.Bronze}, 'Kakamega')`;

    const catalog: [string, string, string, number, number | null, number | null][] = [
      ["Raw shea butter 250g", "Butters", "jar", 650, null, 120],
      ["Whipped shea, lavender 200g", "Butters", "jar", 850, null, 64],
      ["Cocoa butter body cream 300ml", "Butters", "tub", 980, 12, null],
      ["African black soap bar", "Soaps", "bar", 280, null, 300],
      ["Black soap liquid 500ml", "Soaps", "bottle", 720, null, 90],
      ["Turmeric & honey soap", "Soaps", "bar", 320, null, 210],
      ["Cold-pressed baobab oil 100ml", "Oils", "bottle", 1450, 15, 40],
      ["Castor & rosemary hair oil", "Oils", "bottle", 900, null, 75],
      ["Coconut oil, virgin 500ml", "Oils", "jar", 760, null, 150],
      ["Starter gift box", "Bundles", "box", 2400, 12, 30],
      ["Family care bundle", "Bundles", "box", 3900, 12, 18],
    ];
    const products: { id: string; price: number; rate: number | null; name: string }[] = [];
    for (const [i, [name, category, unit, price, rate, stock]] of catalog.entries()) {
      const [p] = await tx<{ id: string }[]>`
        insert into products (org_id, name, sku, category, unit, price, commission_rate, stock, sort)
        values (${org.id}, ${name}, ${`SVN-${100 + i}`}, ${category}, ${unit}, ${price}, ${rate}, ${stock}, ${i}) returning id`;
      products.push({ id: p.id, price, rate, name });
    }

    const tierRate: Record<string, number> = { Gold: 12.5, Silver: 10, Bronze: 8 };
    const customers = ["Mary W.", "John K.", "Aisha M.", "Daniel O.", "Lucy N.", "Samuel K.", "Esther A.", "Paul M.", "Joy C.", "Ali H."];
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let k = 0; k < 140; k++) {
      const si = Math.floor(Math.pow(rand(), 1.6) * sellers.length);
      const m = memberIds[si];
      const daysAgo = Math.floor(rand() * 30);
      const hours = Math.floor(rand() * 12) + 7;
      const created = new Date(Date.now() - daysAgo * 864e5);
      created.setHours(hours, Math.floor(rand() * 60));
      const lines = 1 + Math.floor(rand() * 3);
      const items = Array.from({ length: lines }, () => {
        const p = products[Math.floor(rand() * products.length)];
        const qty = 1 + Math.floor(rand() * 3);
        const total = p.price * qty;
        const rate = p.rate ?? tierRate[sellers[si][4]];
        return { p, qty, total, c: Math.round(total * rate) / 100 };
      });
      const total = items.reduce((s, i) => s + i.total, 0);
      const commission = items.reduce((s, i) => s + i.c, 0);
      const status = daysAgo === 0 ? (rand() < 0.5 ? "new" : "confirmed") : daysAgo < 2 && rand() < 0.4 ? "confirmed" : rand() < 0.06 ? "cancelled" : "fulfilled";
      const [o] = await tx<{ id: string }[]>`
        insert into orders (org_id, ref, reseller_id, customer_name, customer_phone, source, status, paid, total, commission, created_at, updated_at)
        values (${org.id}, ${`A${(100000 + k * 7919).toString(36).toUpperCase()}`}, ${m}, ${customers[k % customers.length]}, ${`07${String(10000000 + k * 104729).slice(0, 8)}`},
          ${rand() < 0.3 ? "storefront" : "reseller"}, ${status}, ${status === "fulfilled"}, ${total}, ${commission}, ${created}, ${created}) returning id`;
      for (const i of items) {
        await tx`insert into order_items (order_id, product_id, name, unit_price, qty, line_total, commission)
          values (${o.id}, ${i.p.id}, ${i.p.name}, ${i.p.price}, ${i.qty}, ${i.total}, ${i.c})`;
      }
    }
    await tx`insert into payouts (org_id, membership_id, amount, method, destination, status, reference, created_at, paid_at)
      values (${org.id}, ${memberIds[0]}, 3500, 'mpesa', '0722111222', 'paid', 'SJK4H7Q2LM', now() - interval '12 days', now() - interval '11 days')`;
    await tx`insert into payouts (org_id, membership_id, amount, method, destination) values (${org.id}, ${memberIds[0]}, 2000, 'mpesa', '0722111222')`;
    await tx`insert into payouts (org_id, membership_id, amount, method, destination) values (${org.id}, ${memberIds[1]}, 1200, 'bank', 'Equity Bank · 0123456789012 · Brian Otieno')`;
    await tx`insert into announcements (org_id, author_id, title, body, pinned)
      values (${org.id}, ${owner.id}, 'December stock is in', 'Gift boxes and the family bundle are back. Gold sellers earn 12% on both until the end of the month.', true),
             (${org.id}, ${owner.id}, 'Payouts every Friday', 'Request before Thursday 6pm and we send M-Pesa on Friday morning.', false)`;
  });
  console.log("[anchor-db] Demo company added. Sign in as owner@savanna.test / anchor-demo (or admin@anchor.test / anchor-admin).");
}
