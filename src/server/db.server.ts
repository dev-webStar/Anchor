import postgres from "postgres";
import { migrations } from "./migrations";

/*
  One Postgres client for the whole server.

  - DATABASE_URL set   → connect to it (Supabase, Neon, Railway, RDS, your own server…)
  - DATABASE_URL empty → in development only, start an embedded Postgres in ./.anchor-db
                         and fill it with a demo company so the app works straight away.
*/

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __anchorSql?: Promise<Sql> };

export function sql(): Promise<Sql> {
  if (!g.__anchorSql) g.__anchorSql = connect();
  return g.__anchorSql;
}

async function connect(): Promise<Sql> {
  let url = process.env.DATABASE_URL;
  let local = false;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set. Add your Postgres connection string to the server environment.");
    }
    url = await startEmbedded();
    local = true;
  }
  const isLocalHost = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const db = postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: isLocalHost ? false : "require",
    prepare: false, // works with transaction poolers (Supabase, PgBouncer)
    idle_timeout: 20,
    onnotice: () => {},
    transform: { undefined: null },
  });
  await migrate(db);
  if (local || process.env.ANCHOR_SEED_DEMO === "1") {
    const { seedDemo } = await import("./seed.server");
    await seedDemo(db);
  }
  return db;
}

async function startEmbedded() {
  const pkg = "embedded-postgres";
  const { default: EmbeddedPostgres } = (await import(/* @vite-ignore */ pkg)) as { default: new (o: object) => any };
  const path = await import("node:path");
  const fs = await import("node:fs");
  const dir = path.resolve(process.env.ANCHOR_LOCAL_DB_DIR ?? ".anchor-db");
  const port = Number(process.env.ANCHOR_LOCAL_DB_PORT ?? 54329);
  const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "anchor",
    password: "anchor",
    port,
    persistent: true,
    onLog: () => {},
    onError: (e: unknown) => console.error("[anchor-db]", String(e)),
  });
  if (fresh) {
    console.log(`[anchor-db] Creating a local database in ${dir} (first run takes a few seconds)…`);
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch (e) {
    // Already running from an earlier dev-server restart — just connect.
    if (!String(e).includes("already") && !String(e).includes("lock")) console.warn("[anchor-db]", String(e));
  }
  if (fresh) await pg.createDatabase("anchor").catch(() => {});
  console.log(`[anchor-db] Local Postgres ready on port ${port}`);
  return `postgres://anchor:anchor@localhost:${port}/anchor`;
}

async function migrate(db: Sql) {
  await db`create table if not exists _migrations (id text primary key, ran_at timestamptz not null default now())`;
  await db.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(732114)`;
    const done = new Set((await tx<{ id: string }[]>`select id from _migrations`).map((r) => r.id));
    for (const m of migrations) {
      if (done.has(m.id)) continue;
      await tx.unsafe(m.sql);
      await tx`insert into _migrations (id) values (${m.id})`;
      console.log(`[anchor-db] Applied migration ${m.id}`);
    }
  });
}
