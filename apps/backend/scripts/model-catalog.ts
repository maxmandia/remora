import { spawnSync } from "node:child_process";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import type {
  ModelDefinitionPlan,
  ModelDefinitionV1,
} from "../src/modules/model/model.types.ts";
import { ModelDefinitionValidationError } from "../src/modules/model/model.types.ts";
import {
  renderModelDefinitionMigration,
  validateModelDefinition,
} from "../src/modules/model/model.utils.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(backendRoot, "../..");
const catalogDirectory = resolve(backendRoot, "catalog/models");
const journalPath = resolve(backendRoot, "drizzle/meta/_journal.json");

config({ path: resolve(repositoryRoot, ".env") });
config({ path: resolve(repositoryRoot, ".env.local"), override: true });

type LoadedDefinition = {
  path: string;
  definition: ModelDefinitionV1;
};

let databaseOpened = false;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "validate":
      await validateCommand(args);
      return;
    case "plan":
      await planCommand(args);
      return;
    case "generate-migration":
      await generateMigrationCommand(args);
      return;
    case "verify":
      await verifyCommand(args);
      return;
    default:
      throw new Error(
        "Usage: model-catalog <validate|plan|generate-migration|verify> ...",
      );
  }
}

async function validateCommand(args: string[]) {
  const definitions = await loadRequestedDefinitions(args[0] ?? "--all");
  validateCatalogIdentity(definitions);

  for (const entry of definitions) {
    console.log(
      `valid ${relative(repositoryRoot, entry.path)} (${entry.definition.model.id})`,
    );
  }
}

async function planCommand(args: string[]) {
  const path = requirePath(args[0], "model:plan <path>");
  assertLocalDatabase();
  const [entry] = await loadRequestedDefinitions(path);
  const plan = await planDefinition(entry.definition);
  printPlan(entry, plan);
  await closeDatabase();

  if (plan.issues.length > 0) {
    process.exitCode = 1;
  }
}

async function generateMigrationCommand(args: string[]) {
  const path = requirePath(
    args[0],
    "model:generate-migration <path> --name <name> [--allow-removals]",
  );
  const name = readFlagValue(args, "--name");
  const allowRemovals = args.includes("--allow-removals");

  if (!name || !/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
    throw new Error(
      "--name is required and must contain only lowercase letters, numbers, hyphens, and underscores",
    );
  }

  assertLocalDatabase();
  const [entry] = await loadRequestedDefinitions(path);
  const plan = await planDefinition(entry.definition);
  printPlan(entry, plan);
  assertPlanValid(plan);

  if (plan.changes.length === 0) {
    throw new Error("The migrated database already matches this definition");
  }

  const sql = renderModelDefinitionMigration(plan, { allowRemovals });
  const before = await readJournalTags();
  const result = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "generate", "--custom", `--name=${name}`],
    { cwd: backendRoot, stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error("Drizzle failed to create a custom migration");
  }

  const after = await readJournalTags();
  const tag = Array.from(after).find((candidate) => !before.has(candidate));

  if (!tag) {
    throw new Error("Could not identify the generated Drizzle migration");
  }

  const migrationPath = resolve(backendRoot, `drizzle/${tag}.sql`);
  await writeFile(migrationPath, sql, "utf8");
  console.log(`generated ${relative(repositoryRoot, migrationPath)}`);
  await closeDatabase();
}

async function verifyCommand(args: string[]) {
  if (args.length > 0) {
    throw new Error("model:verify does not accept arguments");
  }

  assertLocalDatabase();
  const definitions = await loadRequestedDefinitions("--all");
  validateCatalogIdentity(definitions);
  const mismatches: string[] = [];

  for (const entry of definitions) {
    const plan = await planDefinition(entry.definition);

    if (plan.issues.length > 0) {
      mismatches.push(
        `${entry.definition.model.id}: ${plan.issues.join("; ")}`,
      );
    } else if (plan.changes.length > 0) {
      mismatches.push(
        `${entry.definition.model.id}: ${plan.changes
          .map(formatChange)
          .join(", ")}`,
      );
    }
  }

  await closeDatabase();

  if (mismatches.length > 0) {
    throw new ModelDefinitionValidationError(
      "Migrated database does not match the canonical model catalog",
      mismatches,
    );
  }

  console.log(`verified ${definitions.length} canonical model definitions`);
}

async function loadRequestedDefinitions(
  pathOrAll: string,
): Promise<LoadedDefinition[]> {
  const paths =
    pathOrAll === "--all"
      ? (await readdir(catalogDirectory))
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => resolve(catalogDirectory, name))
      : [await resolveDefinitionPath(pathOrAll)];

  if (paths.length === 0) {
    throw new Error(`No model definitions found in ${catalogDirectory}`);
  }

  return Promise.all(
    paths.map(async (path) => {
      const source = await readFile(path, "utf8");
      let value: unknown;

      try {
        value = JSON.parse(source);
      } catch (error) {
        throw new Error(
          `${relative(repositoryRoot, path)} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      return { path, definition: validateModelDefinition(value) };
    }),
  );
}

async function resolveDefinitionPath(path: string) {
  const candidates = [
    resolve(process.cwd(), path),
    resolve(repositoryRoot, path),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported working-directory base.
    }
  }

  return candidates[0];
}

function validateCatalogIdentity(entries: LoadedDefinition[]) {
  const modelIds = new Set<string>();
  const specIds = new Set<string>();
  const rateIds = new Set<string>();
  const rateLimitIds = new Set<string>();
  const bucketShapes = new Map<string, string>();
  const issues: string[] = [];

  for (const { definition } of entries) {
    addUnique(modelIds, definition.model.id, "model", issues);

    for (const spec of definition.specs) {
      addUnique(specIds, spec.id, "model spec", issues);

      for (const rate of spec.rates) {
        addUnique(rateIds, rate.id, "model rate", issues);
      }

      if (spec.rateLimits.mode !== "enforced") {
        continue;
      }

      for (const rule of spec.rateLimits.rules) {
        addUnique(rateLimitIds, rule.id, "model rate limit", issues);
        const bucket = {
          providerId: definition.model.providerId,
          ...rule.bucket,
        };
        const shape = JSON.stringify(bucket, Object.keys(bucket).sort());
        const existing = bucketShapes.get(rule.bucket.id);

        if (existing && existing !== shape) {
          issues.push(
            `Rate-limit bucket ${rule.bucket.id} has conflicting catalog definitions`,
          );
        } else {
          bucketShapes.set(rule.bucket.id, shape);
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new ModelDefinitionValidationError(
      "Canonical model catalog has conflicting identities",
      issues,
    );
  }
}

function addUnique(
  values: Set<string>,
  value: string,
  label: string,
  issues: string[],
) {
  if (values.has(value)) {
    issues.push(`Duplicate ${label} id: ${value}`);
  }

  values.add(value);
}

async function planDefinition(definition: ModelDefinitionV1) {
  databaseOpened = true;
  const { modelService } =
    await import("../src/modules/model/model.service.ts");
  return modelService.planDefinition(definition);
}

async function closeDatabase() {
  if (!databaseOpened) {
    return;
  }

  const { postgresClient } = await import("../src/db/client.ts");
  await postgresClient.end({ timeout: 5 });
  databaseOpened = false;
}

function printPlan(entry: LoadedDefinition, plan: ModelDefinitionPlan) {
  console.log(`model ${entry.definition.model.id}`);

  for (const issue of plan.issues) {
    console.log(`  issue ${issue}`);
  }

  if (plan.changes.length === 0) {
    console.log("  no changes");
    return;
  }

  for (const change of plan.changes) {
    console.log(`  ${formatChange(change)}`);
  }
}

function assertPlanValid(plan: ModelDefinitionPlan) {
  if (plan.issues.length > 0) {
    throw new ModelDefinitionValidationError(
      "Model definition cannot be applied",
      plan.issues,
    );
  }
}

function formatChange(change: ModelDefinitionPlan["changes"][number]) {
  const fields =
    change.fields.length > 0 ? ` [${change.fields.join(", ")}]` : "";
  return `${change.action} ${change.entity} ${change.id}${fields}`;
}

function assertLocalDatabase() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/remora";
  const host = new URL(databaseUrl).hostname;
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

  if (!localHosts.has(host)) {
    throw new Error(
      `Refusing catalog database access on non-local host "${host}"`,
    );
  }
}

async function readJournalTags() {
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  return new Set(journal.entries.map((entry) => entry.tag));
}

function readFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function requirePath(value: string | undefined, usage: string) {
  if (!value || value.startsWith("--")) {
    throw new Error(`Usage: ${usage}`);
  }

  return value;
}

main().catch(async (error: unknown) => {
  await closeDatabase();

  if (error instanceof ModelDefinitionValidationError) {
    console.error(error.message.split(": ")[0]);
    for (const issue of error.issues) {
      console.error(`  - ${issue}`);
    }
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }

  process.exitCode = 1;
});
