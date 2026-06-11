import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseR2StorageEnv } from "@remora/env";
import { hashPassword } from "better-auth/crypto";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "dotenv";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import { createGenerationResultAssetObjectKey } from "../src/modules/generation/generation.utils.ts";
import type {
  GenerationJobSubmittedInput,
  SeedanceUsage,
} from "../src/modules/generation/generation.types.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local"), override: true });

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/remora";
const r2StorageEnv = parseR2StorageEnv(process.env);
const seedHost = new URL(databaseUrl).hostname;
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

if (
  !localHosts.has(seedHost) &&
  process.env.REMORA_ALLOW_NON_LOCAL_DB_SEED !== "1"
) {
  console.error(
    `Refusing to seed non-local database host "${seedHost}". Set REMORA_ALLOW_NON_LOCAL_DB_SEED=1 to override.`,
  );
  process.exit(1);
}

const seedEmail = "m@gmail.com";
const seedPassword = "1234";
const seedUserName = "Remora Seed User";
const seedUserId = "seed-user-m-gmail-com";
const seedModelId = "seedance-2.0-video";
const seedThreadName = "Seeded Ocean Thread";
const seedProviderTaskId = "seedance-dev-task-001";
const seedVideoUrl = "https://example.com/remora-seed-video.mp4";
const submittedInput = {
  prompt:
    "A calm editorial studio shot of a translucent remora-shaped glass sculpture on a steel table, soft morning light, precise camera movement.",
  aspectRatio: "16:9",
  duration: 5,
  generateAudio: true,
} satisfies GenerationJobSubmittedInput;
const usage = {
  completionTokens: null,
  totalTokens: null,
} satisfies SeedanceUsage;

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql, { schema });

try {
  const passwordHash = await hashPassword(seedPassword);
  const now = new Date();

  const seeded = await db.transaction(async (tx) => {
    const [publishedSpec] = await tx
      .select({
        id: schema.generationModelSpec.id,
        providerId: schema.generationModel.providerId,
        spec: schema.generationModelSpec.spec,
      })
      .from(schema.generationModelSpec)
      .innerJoin(
        schema.generationModel,
        eq(schema.generationModel.id, schema.generationModelSpec.modelId),
      )
      .where(
        and(
          eq(schema.generationModel.id, seedModelId),
          eq(schema.generationModel.status, "published"),
          eq(schema.generationModelSpec.status, "published"),
        ),
      )
      .orderBy(desc(schema.generationModelSpec.version))
      .limit(1);

    if (!publishedSpec) {
      throw new Error(`Published model spec was not found for ${seedModelId}.`);
    }

    if (!publishedSpec.spec.providerModelId) {
      throw new Error(
        `Published model spec ${publishedSpec.id} is missing providerModelId.`,
      );
    }

    const [existingUser] = await tx
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, seedEmail))
      .limit(1);
    const userId = existingUser?.id ?? seedUserId;

    if (existingUser) {
      await tx
        .update(schema.user)
        .set({
          name: seedUserName,
          emailVerified: true,
          image: null,
          updatedAt: now,
        })
        .where(eq(schema.user.id, userId));
    } else {
      await tx.insert(schema.user).values({
        id: userId,
        name: seedUserName,
        email: seedEmail,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const credentialAccounts = await tx
      .update(schema.account)
      .set({
        accountId: userId,
        password: passwordHash,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.account.userId, userId),
          eq(schema.account.providerId, "credential"),
        ),
      )
      .returning({ id: schema.account.id });

    if (credentialAccounts.length === 0) {
      await tx.insert(schema.account).values({
        id: `seed-account:${userId}:credential`,
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
    }

    const threadId = `seed-thread:${userId}`;
    const jobId = `seed-job:${userId}`;
    const resultId = `seed-result:${userId}`;
    const videoAssetId = `seed-result-asset:${userId}:video`;
    const videoAssetObjectKey = createGenerationResultAssetObjectKey({
      jobId,
      kind: "video",
    });

    await tx
      .insert(schema.generationThread)
      .values({
        id: threadId,
        userId,
        name: seedThreadName,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.generationThread.id,
        set: {
          userId,
          name: seedThreadName,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.generationJob)
      .values({
        id: jobId,
        threadId,
        userId,
        modelId: seedModelId,
        modelSpecId: publishedSpec.id,
        status: "succeeded",
        submittedInput,
        temporalWorkflowId: `seed-workflow:${jobId}`,
        temporalRunId: `seed-run:${jobId}`,
        callbackTokenHash: createHash("sha256")
          .update(`seed-callback-token:${jobId}`)
          .digest("hex"),
        providerId: publishedSpec.providerId,
        providerTaskId: seedProviderTaskId,
        providerModelId: publishedSpec.spec.providerModelId,
        terminalError: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.generationJob.id,
        set: {
          threadId,
          userId,
          modelId: seedModelId,
          modelSpecId: publishedSpec.id,
          status: "succeeded",
          submittedInput,
          temporalWorkflowId: `seed-workflow:${jobId}`,
          temporalRunId: `seed-run:${jobId}`,
          callbackTokenHash: createHash("sha256")
            .update(`seed-callback-token:${jobId}`)
            .digest("hex"),
          providerId: publishedSpec.providerId,
          providerTaskId: seedProviderTaskId,
          providerModelId: publishedSpec.spec.providerModelId,
          terminalError: null,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.generationResult)
      .values({
        id: resultId,
        jobId,
        providerId: publishedSpec.providerId,
        providerTaskId: seedProviderTaskId,
        providerModelId: publishedSpec.spec.providerModelId,
        providerStatus: "succeeded",
        videoUrl: seedVideoUrl,
        lastFrameUrl: null,
        usage,
        providerError: null,
        rawPayload: {
          id: seedProviderTaskId,
          model: publishedSpec.spec.providerModelId,
          status: "succeeded",
          video_url: seedVideoUrl,
          usage,
        },
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.generationResult.jobId,
        set: {
          providerId: publishedSpec.providerId,
          providerTaskId: seedProviderTaskId,
          providerModelId: publishedSpec.spec.providerModelId,
          providerStatus: "succeeded",
          videoUrl: seedVideoUrl,
          lastFrameUrl: null,
          usage,
          providerError: null,
          rawPayload: {
            id: seedProviderTaskId,
            model: publishedSpec.spec.providerModelId,
            status: "succeeded",
            video_url: seedVideoUrl,
            usage,
          },
          receivedAt: now,
          updatedAt: now,
        },
      });

    await tx
      .insert(schema.generationResultAsset)
      .values({
        id: videoAssetId,
        resultId,
        kind: "video",
        bucket: r2StorageEnv.R2_BUCKET_NAME,
        objectKey: videoAssetObjectKey,
        contentType: "video/mp4",
        contentLength: null,
        etag: null,
        checksumSha256: null,
        sourceProviderUrl: seedVideoUrl,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.generationResultAsset.resultId,
          schema.generationResultAsset.kind,
        ],
        set: {
          bucket: r2StorageEnv.R2_BUCKET_NAME,
          objectKey: videoAssetObjectKey,
          contentType: "video/mp4",
          contentLength: null,
          etag: null,
          checksumSha256: null,
          sourceProviderUrl: seedVideoUrl,
          updatedAt: now,
        },
      });

    return {
      userId,
      threadId,
      jobId,
      resultId,
      modelSpecId: publishedSpec.id,
    };
  });

  console.log("Seeded dev data:");
  console.log(`- User: ${seedEmail} (${seeded.userId})`);
  console.log(`- Thread: ${seeded.threadId}`);
  console.log(`- Job: ${seeded.jobId}`);
  console.log(`- Result: ${seeded.resultId}`);
  console.log(`- Model spec: ${seeded.modelSpecId}`);
} finally {
  await sql.end({ timeout: 5 });
}
