import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import postgres from "postgres";

import {
  MigrationExecutionError,
  runMigrations,
  type NamedMigration,
} from "./migrate.ts";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/remora";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const databaseHost = new URL(databaseUrl).hostname;
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

if (!localHosts.has(databaseHost)) {
  throw new Error(
    `Refusing to run migration integration tests against non-local database host "${databaseHost}".`,
  );
}

const silentLogger = {
  error() {},
  info() {},
};

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function createMigration(
  tag: string,
  folderMillis: number,
  sql: string[],
): NamedMigration {
  return {
    bps: true,
    folderMillis,
    hash: `hash-${folderMillis}`,
    sql,
    tag,
  };
}

async function withMigrationSchema(
  callback: (context: {
    kindType: string;
    ledgerTable: string;
    lockKey: string;
    schema: string;
    table: string;
  }) => Promise<void>,
): Promise<void> {
  const schema = `migration_test_${randomUUID().replaceAll("-", "")}`;
  const kindType = "asset_kind";
  const ledgerTable = "migration_ledger";
  const table = "asset";
  const sql = postgres(databaseUrl, { max: 10 });

  try {
    await sql`create schema ${sql(schema)}`;
    await sql.unsafe(
      `create type ${quoteIdentifier(schema)}.${quoteIdentifier(kindType)} as enum ('video')`,
    );
    await sql.unsafe(
      `create table ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (id text primary key, kind ${quoteIdentifier(schema)}.${quoteIdentifier(kindType)} not null)`,
    );
    await sql.unsafe(
      `insert into ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (id, kind) values ('existing-video', 'video')`,
    );

    await callback({
      kindType,
      ledgerTable,
      lockKey: `remora:migration-test:${schema}`,
      schema,
      table,
    });
  } finally {
    await sql`drop schema if exists ${sql(schema)} cascade`;
    await sql.end({ timeout: 5 });
  }
}

test("commits enum additions before later migrations and resumes after failure", async () => {
  await withMigrationSchema(
    async ({ kindType, ledgerTable, lockKey, schema, table }) => {
      const sql = postgres(databaseUrl, { max: 5 });
      const qualifiedType = `${quoteIdentifier(schema)}.${quoteIdentifier(kindType)}`;
      const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const migrations = [
        createMigration("0001_add_image_enum", 1, [
          `alter type ${qualifiedType} add value 'image'`,
        ]),
        createMigration("0002_insert_image", 2, [
          `insert into ${qualifiedTable} (id, kind) values ('generated-image', 'image')`,
        ]),
      ];

      try {
        await runMigrations({
          lockKey,
          logger: silentLogger,
          migrations,
          migrationsSchema: schema,
          migrationsTable: ledgerTable,
          sql,
        });
        await runMigrations({
          lockKey,
          logger: silentLogger,
          migrations,
          migrationsSchema: schema,
          migrationsTable: ledgerTable,
          sql,
        });

        const assets = await sql.unsafe<{ id: string; kind: string }[]>(
          `select id, kind::text from ${qualifiedTable} order by id`,
        );
        const ledger = await sql.unsafe<{ count: string }[]>(
          `select count(*)::text as count from ${quoteIdentifier(schema)}.${quoteIdentifier(ledgerTable)}`,
        );

        assert.deepEqual(
          assets.map((asset) => ({ ...asset })),
          [
            { id: "existing-video", kind: "video" },
            { id: "generated-image", kind: "image" },
          ],
        );
        assert.equal(ledger[0]?.count, "2");

        const failingMigrations = [
          ...migrations,
          createMigration("0003_rolls_back", 3, [
            `insert into ${qualifiedTable} (id, kind) values ('rolled-back-image', 'image')`,
            `insert into ${qualifiedTable} (missing_column) values ('failure')`,
          ]),
        ];

        await assert.rejects(
          runMigrations({
            lockKey,
            logger: silentLogger,
            migrations: failingMigrations,
            migrationsSchema: schema,
            migrationsTable: ledgerTable,
            sql,
          }),
          (error: unknown) =>
            error instanceof MigrationExecutionError &&
            error.migrationTag === "0003_rolls_back",
        );

        const rolledBackRows = await sql.unsafe<{ count: string }[]>(
          `select count(*)::text as count from ${qualifiedTable} where id = 'rolled-back-image'`,
        );
        const ledgerAfterFailure = await sql.unsafe<{ count: string }[]>(
          `select count(*)::text as count from ${quoteIdentifier(schema)}.${quoteIdentifier(ledgerTable)}`,
        );

        assert.equal(rolledBackRows[0]?.count, "0");
        assert.equal(ledgerAfterFailure[0]?.count, "2");
      } finally {
        await sql.end({ timeout: 5 });
      }
    },
  );
});

test("serializes concurrent migration callers with an advisory lock", async () => {
  await withMigrationSchema(
    async ({ kindType, ledgerTable, lockKey, schema, table }) => {
      const firstSql = postgres(databaseUrl, { max: 2 });
      const secondSql = postgres(databaseUrl, { max: 2 });
      const qualifiedType = `${quoteIdentifier(schema)}.${quoteIdentifier(kindType)}`;
      const qualifiedTable = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
      const migrations = [
        createMigration("0001_add_image_enum", 1, [
          "select pg_sleep(0.1)",
          `alter type ${qualifiedType} add value 'image'`,
        ]),
        createMigration("0002_insert_image", 2, [
          `insert into ${qualifiedTable} (id, kind) values ('generated-image', 'image')`,
        ]),
      ];
      const options = {
        lockKey,
        lockTimeoutMs: 2_000,
        logger: silentLogger,
        migrations,
        migrationsSchema: schema,
        migrationsTable: ledgerTable,
      };

      try {
        await Promise.all([
          runMigrations({ ...options, sql: firstSql }),
          runMigrations({ ...options, sql: secondSql }),
        ]);

        const ledger = await firstSql.unsafe<{ count: string }[]>(
          `select count(*)::text as count from ${quoteIdentifier(schema)}.${quoteIdentifier(ledgerTable)}`,
        );
        const imageRows = await firstSql.unsafe<{ count: string }[]>(
          `select count(*)::text as count from ${qualifiedTable} where id = 'generated-image'`,
        );

        assert.equal(ledger[0]?.count, "2");
        assert.equal(imageRows[0]?.count, "1");
      } finally {
        await Promise.all([
          firstSql.end({ timeout: 5 }),
          secondSql.end({ timeout: 5 }),
        ]);
      }
    },
  );
});
