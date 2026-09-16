import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy connection: nothing touches `DATABASE_URL` until the first query.
 * `next build` imports route modules while collecting page data without a
 * database configured, and the Next.js dev server re-evaluates modules on
 * HMR, so the real client is created once and cached on globalThis.
 */
type Sql = ReturnType<typeof postgres>;
type RealDb = ReturnType<typeof drizzle<typeof schema>>;

const g = globalThis as unknown as { __artifactsSql?: Sql; __artifactsDb?: RealDb };

export function getSql(): Sql {
  if (!g.__artifactsSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    g.__artifactsSql = postgres(url, { max: 10, idle_timeout: 30, prepare: false });
  }
  return g.__artifactsSql;
}

function getDb(): RealDb {
  if (!g.__artifactsDb) g.__artifactsDb = drizzle(getSql(), { schema });
  return g.__artifactsDb;
}

/** Drizzle instance; every property access resolves the real client on demand. */
export const db: RealDb = new Proxy({} as RealDb, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export type Db = RealDb;
export { schema };
