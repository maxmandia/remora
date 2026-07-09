import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const outDir = path.join(appDir, "out");
const makeDir = path.join(outDir, "make");

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPackagedApps() {
  const entries = await fs.readdir(outDir, { withFileTypes: true });
  const appPaths = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "make") {
      continue;
    }

    const packageDir = path.join(outDir, entry.name);
    const packageEntries = await fs.readdir(packageDir, { withFileTypes: true });

    for (const packageEntry of packageEntries) {
      if (packageEntry.isDirectory() && packageEntry.name.endsWith(".app")) {
        appPaths.push(path.join(packageDir, packageEntry.name));
      }
    }
  }

  return appPaths;
}

async function resolveAppPath() {
  const explicitPath =
    process.argv.slice(2).find((argument) => argument !== "--") ||
    process.env.DESKTOP_APP_PATH;

  if (explicitPath) {
    const appPath = path.resolve(appDir, explicitPath);

    if (!(await pathExists(appPath))) {
      throw new Error(`Packaged app does not exist: ${appPath}`);
    }

    return appPath;
  }

  const appPaths = await findPackagedApps();

  if (appPaths.length !== 1) {
    throw new Error(
      [
        `Expected exactly one packaged app in ${outDir}, found ${appPaths.length}.`,
        ...appPaths.map((appPath) => `- ${appPath}`),
        "Pass an app path or set DESKTOP_APP_PATH to choose explicitly.",
      ].join("\n"),
    );
  }

  return appPaths[0];
}

async function removeStaleDmgs() {
  await fs.mkdir(makeDir, { recursive: true });

  const entries = await fs.readdir(makeDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".dmg"))
      .map((entry) => fs.rm(path.join(makeDir, entry.name), { force: true })),
  );
}

function runCreateDmg(appPath) {
  const createDmg = spawn(
    "create-dmg",
    [
      appPath,
      makeDir,
      "--overwrite",
      "--no-version-in-filename",
      "--no-code-sign",
    ],
    {
      cwd: appDir,
      stdio: "inherit",
    },
  );

  return new Promise((resolve, reject) => {
    createDmg.on("error", reject);
    createDmg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`create-dmg exited with status ${code}`));
    });
  });
}

function rebuildCreateDmgNativeDependencies() {
  const pnpm = spawn(
    "pnpm",
    [
      "rebuild",
      "fs-xattr",
      "macos-alias",
      "--config.only-built-dependencies=fs-xattr",
      "--config.only-built-dependencies=macos-alias",
    ],
    {
      cwd: appDir,
      stdio: "inherit",
    },
  );

  return new Promise((resolve, reject) => {
    pnpm.on("error", reject);
    pnpm.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pnpm rebuild exited with status ${code}`));
    });
  });
}

if (process.platform !== "darwin") {
  throw new Error("DMG creation is only supported on macOS.");
}

const appPath = await resolveAppPath();
await rebuildCreateDmgNativeDependencies();
await removeStaleDmgs();
await runCreateDmg(appPath);
