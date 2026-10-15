import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForPool = globalThis as unknown as { wordGamePool?: Pool };

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured. Add it to .env first.");
  }

  if (!globalForPool.wordGamePool) {
    globalForPool.wordGamePool = new Pool({ connectionString });
  }
  return globalForPool.wordGamePool;
}

export function getDb() {
  return drizzle({ client: getPool(), schema });
}
