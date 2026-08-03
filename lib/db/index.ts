import { drizzle } from "drizzle-orm/d1";
import { getBindings } from "@/lib/cf";
import * as schema from "./schema";

export type Db = ReturnType<typeof getDb>;

/** Per-request Drizzle client over the D1 binding. */
export function getDb() {
  return drizzle(getBindings().DB, { schema });
}

export * as tables from "./schema";
export { schema };
