import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { parseBackendDbEnv } from "@remora/env";

import * as schema from "./schema.ts";

const env = parseBackendDbEnv(process.env);
export const postgresClient = postgres(env.DATABASE_URL);

export const db = drizzle(postgresClient, { schema });
export { schema };

export type DatabaseClient = typeof db;
export type DatabaseTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];
export type DatabaseExecutor = DatabaseClient | DatabaseTransaction;
