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
import {
  createGenerationResultAssetObjectKey,
  createGenerationResultPreviewObjectKey,
} from "../src/modules/generation/generation.utils.ts";
import {
  maxRequestedGenerations,
  type GenerationSubmissionInput,
  type SeedanceUsage,
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
} satisfies GenerationSubmissionInput;
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

    const additionalSeedRequestedGenerations = [5, 10, maxRequestedGenerations];
    const seedFixtures = [
      {
        legacyIds: true,
        requestedGenerations: 1,
        submissionId: `seed-submission:${userId}`,
        threadId: `seed-thread:${userId}`,
        threadName: seedThreadName,
      },
      ...additionalSeedRequestedGenerations.map((requestedGenerations) => ({
        legacyIds: false,
        requestedGenerations,
        submissionId: `seed-submission:${userId}:${requestedGenerations}-generations`,
        threadId: `seed-thread:${userId}:${requestedGenerations}-generations`,
        threadName: `Seeded Ocean Thread - ${requestedGenerations} Outputs`,
      })),
    ];

    async function seedGenerationFixture({
      fixture,
      fixtureTimestamp,
    }: {
      fixture: (typeof seedFixtures)[number];
      fixtureTimestamp: Date;
    }) {
      await tx
        .insert(schema.generationThread)
        .values({
          id: fixture.threadId,
          userId,
          name: fixture.threadName,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationThread.id,
          set: {
            userId,
            name: fixture.threadName,
            updatedAt: fixtureTimestamp,
          },
        });

      await tx
        .insert(schema.generationSubmission)
        .values({
          id: fixture.submissionId,
          threadId: fixture.threadId,
          userId,
          modelId: seedModelId,
          modelSpecId: publishedSpec.id,
          submittedInput,
          requestedGenerations: fixture.requestedGenerations,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationSubmission.id,
          set: {
            threadId: fixture.threadId,
            userId,
            modelId: seedModelId,
            modelSpecId: publishedSpec.id,
            submittedInput,
            requestedGenerations: fixture.requestedGenerations,
            updatedAt: fixtureTimestamp,
          },
        });

      const seededJobIds: string[] = [];
      const seededResultIds: string[] = [];

      for (
        let submissionIndex = 0;
        submissionIndex < fixture.requestedGenerations;
        submissionIndex += 1
      ) {
        const fixtureIdSegment = `${fixture.requestedGenerations}-generations:${submissionIndex}`;
        const jobId = fixture.legacyIds
          ? `seed-job:${userId}`
          : `seed-job:${userId}:${fixtureIdSegment}`;
        const resultId = fixture.legacyIds
          ? `seed-result:${userId}`
          : `seed-result:${userId}:${fixtureIdSegment}`;
        const videoAssetId = fixture.legacyIds
          ? `seed-result-asset:${userId}:video`
          : `seed-result-asset:${userId}:${fixtureIdSegment}:video`;
        const previewId = fixture.legacyIds
          ? `seed-result-preview:${userId}`
          : `seed-result-preview:${userId}:${fixtureIdSegment}`;
        const providerTaskId = fixture.legacyIds
          ? seedProviderTaskId
          : `seedance-dev-task-${fixture.requestedGenerations}-${String(
              submissionIndex + 1,
            ).padStart(2, "0")}`;
        const callbackTokenHash = createHash("sha256")
          .update(`seed-callback-token:${jobId}`)
          .digest("hex");
        const rawPayload = {
          id: providerTaskId,
          model: publishedSpec.spec.providerModelId,
          status: "succeeded",
          video_url: seedVideoUrl,
          usage,
        };
        const videoAssetObjectKey = createGenerationResultAssetObjectKey({
          jobId,
          kind: "video",
        });
        const previewObjectKey = createGenerationResultPreviewObjectKey({
          jobId,
        });

        await tx
          .insert(schema.generationJob)
          .values({
            id: jobId,
            submissionId: fixture.submissionId,
            submissionIndex,
            status: "succeeded",
            temporalWorkflowId: `seed-workflow:${jobId}`,
            temporalRunId: `seed-run:${jobId}`,
            callbackTokenHash,
            providerId: publishedSpec.providerId,
            providerTaskId,
            providerModelId: publishedSpec.spec.providerModelId,
            terminalError: null,
            createdAt: fixtureTimestamp,
            updatedAt: fixtureTimestamp,
          })
          .onConflictDoUpdate({
            target: schema.generationJob.id,
            set: {
              submissionId: fixture.submissionId,
              submissionIndex,
              status: "succeeded",
              temporalWorkflowId: `seed-workflow:${jobId}`,
              temporalRunId: `seed-run:${jobId}`,
              callbackTokenHash,
              providerId: publishedSpec.providerId,
              providerTaskId,
              providerModelId: publishedSpec.spec.providerModelId,
              terminalError: null,
              updatedAt: fixtureTimestamp,
            },
          });

        await tx
          .insert(schema.generationResult)
          .values({
            id: resultId,
            jobId,
            providerId: publishedSpec.providerId,
            providerTaskId,
            providerModelId: publishedSpec.spec.providerModelId,
            providerStatus: "succeeded",
            videoUrl: seedVideoUrl,
            usage,
            providerError: null,
            rawPayload,
            receivedAt: fixtureTimestamp,
            createdAt: fixtureTimestamp,
            updatedAt: fixtureTimestamp,
          })
          .onConflictDoUpdate({
            target: schema.generationResult.jobId,
            set: {
              providerId: publishedSpec.providerId,
              providerTaskId,
              providerModelId: publishedSpec.spec.providerModelId,
              providerStatus: "succeeded",
              videoUrl: seedVideoUrl,
              usage,
              providerError: null,
              rawPayload,
              receivedAt: fixtureTimestamp,
              updatedAt: fixtureTimestamp,
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
            createdAt: fixtureTimestamp,
            updatedAt: fixtureTimestamp,
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
              updatedAt: fixtureTimestamp,
            },
          });

        await tx
          .insert(schema.generationResultPreview)
          .values({
            id: previewId,
            resultId,
            bucket: r2StorageEnv.R2_BUCKET_NAME,
            objectKey: previewObjectKey,
            contentType: "image/jpeg",
            contentLength: null,
            etag: null,
            checksumSha256: null,
            frameTimeMs: 1000,
            createdAt: fixtureTimestamp,
            updatedAt: fixtureTimestamp,
          })
          .onConflictDoUpdate({
            target: schema.generationResultPreview.resultId,
            set: {
              bucket: r2StorageEnv.R2_BUCKET_NAME,
              objectKey: previewObjectKey,
              contentType: "image/jpeg",
              contentLength: null,
              etag: null,
              checksumSha256: null,
              frameTimeMs: 1000,
              updatedAt: fixtureTimestamp,
            },
          });

        seededJobIds.push(jobId);
        seededResultIds.push(resultId);
      }

      return {
        threadId: fixture.threadId,
        submissionId: fixture.submissionId,
        requestedGenerations: fixture.requestedGenerations,
        jobIds: seededJobIds,
        resultIds: seededResultIds,
      };
    }

    const fixtures = [];

    for (const [fixtureIndex, fixture] of seedFixtures.entries()) {
      fixtures.push(
        await seedGenerationFixture({
          fixture,
          fixtureTimestamp: new Date(now.getTime() - fixtureIndex),
        }),
      );
    }

    return {
      userId,
      fixtures,
      modelSpecId: publishedSpec.id,
    };
  });

  console.log("Seeded dev data:");
  console.log(`- User: ${seedEmail} (${seeded.userId})`);
  for (const fixture of seeded.fixtures) {
    const generationLabel =
      fixture.requestedGenerations === 1 ? "generation" : "generations";

    console.log(
      `- Thread: ${fixture.threadId} (${fixture.requestedGenerations} ${generationLabel})`,
    );
    console.log(`  Submission: ${fixture.submissionId}`);
    console.log(`  Jobs: ${fixture.jobIds.length}`);
    console.log(`  Results: ${fixture.resultIds.length}`);
  }
  console.log(`- Model spec: ${seeded.modelSpecId}`);
} finally {
  await sql.end({ timeout: 5 });
}
