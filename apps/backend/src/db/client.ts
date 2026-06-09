import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { parseBackendDbEnv } from "@remora/env";

import * as schema from "./schema.ts";

const env = parseBackendDbEnv(process.env);
const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });
export { schema };
