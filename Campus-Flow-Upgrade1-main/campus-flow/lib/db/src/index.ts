import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: url });
export const db = drizzle(pool, { schema });

export * from "./schema";
