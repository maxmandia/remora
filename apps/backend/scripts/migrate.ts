import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import postgres, { type ReservedSql, type Sql } from "postgres";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/remora";
const DEFAULT_MIGRATIONS_SCHEMA = "drizzle";
const DEFAULT_MIGRATIONS_TABLE = "__drizzle_migrations";
const DEFAULT_LOCK_KEY = "remora:database-migrations";
const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
const LOCK_RETRY_MS = 250;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const migrationsFolder = resolve(scriptDir, "../drizzle");

export interface NamedMigration extends MigrationMeta {
  tag: string;
}

interface MigrationJournalEntry {
  tag: string;
  when: number;
}

interface MigrationLogger {
  error(message: string): void;
  info(message: string): void;
}

interface RunMigrationsOptions {
  lockKey?: string;
  lockTimeoutMs?: number;
  logger?: MigrationLogger;
  migrations: readonly NamedMigration[];
  migrationsSchema?: string;
  migrationsTable?: string;
  sql: Sql;
}

interface AppliedMigrationRow {
  created_at: string;
}

interface AdvisoryLockRow {
  acquired: boolean;
}

const consoleLogger: MigrationLogger = {
  error(message) {
    console.error(message);
  },
  info(message) {
    console.log(message);
  },
};

export class MigrationExecutionError extends Error {
  constructor(
    readonly migrationTag: string,
    options: ErrorOptions,
  ) {
    super(`Migration "${migrationTag}" failed.`, options);
    this.name = "MigrationExecutionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorField(error: unknown, field: string): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const value = error[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getErrorMessage(error: unknown): string {
  return getErrorField(error, "message") ?? "Unknown database error.";
}

function logMigrationError(
  logger: MigrationLogger,
  migrationTag: string,
  error: unknown,
): void {
  logger.error(
    `[db:migrate] Migration "${migrationTag}" failed: ${getErrorMessage(error)}`,
  );

  for (const field of ["code", "detail", "hint"] as const) {
    const value = getErrorField(error, field);
    if (value !== undefined) {
      logger.error(`[db:migrate] ${field}: ${value}`);
    }
  }
}

function isMigrationJournalEntry(
  value: unknown,
): value is MigrationJournalEntry {
  return (
    isRecord(value) &&
    typeof value.tag === "string" &&
    typeof value.when === "number"
  );
}

function loadNamedMigrations(folder: string): NamedMigration[] {
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  const journal: unknown = JSON.parse(
    readFileSync(resolve(folder, "meta/_journal.json"), "utf8"),
  );

  if (!isRecord(journal) || !Array.isArray(journal.entries)) {
    throw new Error("Invalid Drizzle migration journal.");
  }

  const entries = journal.entries;
  if (
    entries.length !== migrations.length ||
    !entries.every(isMigrationJournalEntry)
  ) {
    throw new Error(
      "Drizzle migration journal does not match migration files.",
    );
  }

  return migrations.map((migration, index) => {
    const entry = entries[index];
    if (entry === undefined || entry.when !== migration.folderMillis) {
      throw new Error(
        `Drizzle migration journal timestamp mismatch at index ${index}.`,
      );
    }

    return { ...migration, tag: entry.tag };
  });
}

async function acquireMigrationLock(
  sql: ReservedSql,
  lockKey: string,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();

  while (true) {
    const [row] = await sql<AdvisoryLockRow[]>`
      select pg_try_advisory_lock(
        hashtextextended(${lockKey}, 0)
      ) as acquired
    `;

    if (row?.acquired === true) {
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for the database migration lock.`,
      );
    }

    await delay(Math.min(LOCK_RETRY_MS, timeoutMs - elapsedMs));
  }
}

async function releaseMigrationLock(
  sql: ReservedSql,
  lockKey: string,
  logger: MigrationLogger,
): Promise<void> {
  try {
    await sql`
      select pg_advisory_unlock(
        hashtextextended(${lockKey}, 0)
      )
    `;
  } catch (error) {
    logger.error(
      `[db:migrate] Failed to release the migration lock: ${getErrorMessage(error)}`,
    );
  }
}

export async function runMigrations({
  lockKey = DEFAULT_LOCK_KEY,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  logger = consoleLogger,
  migrations,
  migrationsSchema = DEFAULT_MIGRATIONS_SCHEMA,
  migrationsTable = DEFAULT_MIGRATIONS_TABLE,
  sql,
}: RunMigrationsOptions): Promise<void> {
  const connection = await sql.reserve();
  let lockAcquired = false;

  try {
    await acquireMigrationLock(connection, lockKey, lockTimeoutMs);
    lockAcquired = true;

    await connection`
      create schema if not exists ${connection(migrationsSchema)}
    `;
    await connection`
      create table if not exists
        ${connection(migrationsSchema)}.${connection(migrationsTable)} (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
    `;

    const [lastAppliedMigration] = await connection<AppliedMigrationRow[]>`
      select created_at
      from ${connection(migrationsSchema)}.${connection(migrationsTable)}
      order by created_at desc
      limit 1
    `;
    const lastAppliedAt = lastAppliedMigration
      ? Number(lastAppliedMigration.created_at)
      : Number.NEGATIVE_INFINITY;
    const pendingMigrations = migrations.filter(
      (migration) => migration.folderMillis > lastAppliedAt,
    );

    if (pendingMigrations.length === 0) {
      logger.info("[db:migrate] No pending migrations.");
      return;
    }

    for (const migration of pendingMigrations) {
      logger.info(`[db:migrate] Applying ${migration.tag}...`);

      try {
        await connection.unsafe("begin");

        try {
          for (const statement of migration.sql) {
            if (statement.trim().length > 0) {
              await connection.unsafe(statement);
            }
          }

          await connection`
            insert into
              ${connection(migrationsSchema)}.${connection(migrationsTable)}
              (hash, created_at)
            values (${migration.hash}, ${migration.folderMillis})
          `;
          await connection.unsafe("commit");
        } catch (error) {
          try {
            await connection.unsafe("rollback");
          } catch (rollbackError) {
            logger.error(
              `[db:migrate] Failed to roll back "${migration.tag}": ${getErrorMessage(rollbackError)}`,
            );
          }
          throw error;
        }
      } catch (error) {
        logMigrationError(logger, migration.tag, error);
        throw new MigrationExecutionError(migration.tag, { cause: error });
      }

      logger.info(`[db:migrate] Applied ${migration.tag}.`);
    }
  } finally {
    if (lockAcquired) {
      await releaseMigrationLock(connection, lockKey, logger);
    }
    connection.release();
  }
}

async function main(): Promise<void> {
  config({ path: resolve(repoRoot, ".env") });
  config({ path: resolve(repoRoot, ".env.local"), override: true });

  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await runMigrations({
      migrations: loadNamedMigrations(migrationsFolder),
      sql,
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof MigrationExecutionError)) {
      console.error(`[db:migrate] ${getErrorMessage(error)}`);
    }
    process.exitCode = 1;
  }
}
