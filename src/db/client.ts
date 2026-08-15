import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Check .env.local.");
}

const globalForDb = globalThis as unknown as {
  __pgClient__: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.__pgClient__ ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient__ = client;
}

export const db = drizzle(client, { schema });
export type Db = typeof db;
