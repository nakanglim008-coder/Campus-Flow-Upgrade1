import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@workspace/db/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured");
    const pool = new Pool({ connectionString: url, ssl: url.includes("neon.tech") ? { rejectUnauthorized: false } : false });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
