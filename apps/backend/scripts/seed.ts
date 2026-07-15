import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseR2StorageEnv } from "@remora/env";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import {
  maxRequestedGenerations,
  type GenerationProviderTaskUsage,
  type GenerationSubmissionInput,
} from "../src/modules/generation/generation.types.ts";
import { createGenerationResultAssetObjectKey } from "../src/modules/generation/generation.utils.ts";

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
const seedInitialCreditAmountUsdMicros = 1_000_000_000;
const seedStripeCustomerId = "cus_UkdlwCn7lpVJTw";
const seedModelId = "seedance-2.0-video";
const seedExampleProjectName = "Example Project";
const seedThreadName = "Seeded Ocean Thread";
const seedExampleProjectThreadName = "Dummy Thread";
const seedPendingThreadName = "Seeded Pending Ocean Thread";
const seedProviderTaskId = "seedance-dev-task-001";
const seedVideoUrl = "https://example.com/remora-seed-video.mp4";
const seedPreviewObjectKey = "generations/seed/video-preview.png";
const seedPreviewContentType = "image/png";
const seedPreviewContentLength = 3066174;
const seedPreviewEtag = '"a96e50db2d8c3f3a1b6f3bbd117063dc"';
const seedPreviewChecksumSha256 =
  "a35c29b6ee8c2cfcc6474da415b5a7009afeb332b0ca3b8306df23b64560d7b7";
const submittedInput = {
  prompt:
    "A calm editorial studio shot of a translucent remora-shaped glass sculpture on a steel table, soft morning light, precise camera movement.",
  resolution: "720p",
  aspectRatio: "16:9",
  duration: 5,
  generateAudio: true,
} satisfies GenerationSubmissionInput;
const usage = {
  completionTokens: null,
  totalTokens: null,
} satisfies GenerationProviderTaskUsage;

type SeedGenerationFixture = {
  legacyIds: boolean;
  projectId?: string | null;
  requestedGenerations: number;
  submissionCount?: number;
  submissionId: string;
  threadId: string;
  threadName: string;
};

function formatSeedIndex(index: number) {
  return String(index + 1).padStart(2, "0");
}

function createSeedSubmissionId({
  fixture,
  threadSubmissionIndex,
}: {
  fixture: SeedGenerationFixture;
  threadSubmissionIndex: number;
}) {
  if (threadSubmissionIndex === 0) {
    return fixture.submissionId;
  }

  return `${fixture.submissionId}:submission-${formatSeedIndex(threadSubmissionIndex)}`;
}

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

    const [existingBillingProfile] = await tx
      .select({ userId: schema.billingProfile.userId })
      .from(schema.billingProfile)
      .where(eq(schema.billingProfile.userId, userId))
      .limit(1);

    if (!existingBillingProfile) {
      await tx.insert(schema.billingProfile).values({
        userId,
        stripeCustomerId: seedStripeCustomerId,
        defaultStripePaymentMethodId: null,
        offSessionPaymentsEnabled: false,
        offSessionConsentAt: null,
        paymentMethodStatus: "none",
        createdAt: now,
        updatedAt: now,
      });
    }

    const [existingAutoTopUpSettings] = await tx
      .select({ userId: schema.creditAutoTopUpSettings.userId })
      .from(schema.creditAutoTopUpSettings)
      .where(eq(schema.creditAutoTopUpSettings.userId, userId))
      .limit(1);

    if (!existingAutoTopUpSettings) {
      await tx.insert(schema.creditAutoTopUpSettings).values({
        userId,
        enabled: false,
        topUpFloorUsdMicros: 0,
        topUpAmountUsdMicros: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [existingBalance] = await tx
      .select({ userId: schema.userBalance.userId })
      .from(schema.userBalance)
      .where(eq(schema.userBalance.userId, userId))
      .limit(1);
    let seededCreditGrantAmountUsdMicros: number | null = null;

    if (!existingBalance) {
      await tx.insert(schema.userBalance).values({
        userId,
        availableCreditAmountUsdMicros: seedInitialCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros: 0,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(schema.creditLedgerEntry).values({
        id: `seed-credit-ledger-entry:${userId}:initial-grant`,
        userId,
        entryType: "admin_credit_adjustment",
        availableCreditDeltaUsdMicros: seedInitialCreditAmountUsdMicros,
        reservedCreditDeltaUsdMicros: 0,
        availableCreditAmountUsdMicrosAfter: seedInitialCreditAmountUsdMicros,
        reservedCreditAmountUsdMicrosAfter: 0,
        generationJobId: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripeEventId: null,
        idempotencyKey: `seed:credit-grant:${userId}:initial`,
        metadata: { reason: "seed_initial_credit_grant" },
        createdAt: now,
      });

      seededCreditGrantAmountUsdMicros = seedInitialCreditAmountUsdMicros;
    }

    const seedExampleProjectId = `seed-project:${userId}:example`;

    await tx
      .insert(schema.project)
      .values({
        id: seedExampleProjectId,
        userId,
        name: seedExampleProjectName,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.project.id,
        set: {
          userId,
          name: seedExampleProjectName,
          archivedAt: null,
          updatedAt: now,
        },
      });

    const additionalSeedRequestedGenerations = [5, 10, maxRequestedGenerations];
    const pendingFixture = {
      jobId: `seed-job:${userId}:pending`,
      requestedGenerations: 1,
      submissionId: `seed-submission:${userId}:pending`,
      threadId: `seed-thread:${userId}:pending`,
      threadName: seedPendingThreadName,
    };
    const seedFixtures = [
      {
        legacyIds: true,
        requestedGenerations: 1,
        submissionId: `seed-submission:${userId}`,
        threadId: `seed-thread:${userId}`,
        threadName: seedThreadName,
      },
      {
        legacyIds: false,
        projectId: seedExampleProjectId,
        requestedGenerations: 1,
        submissionId: `seed-submission:${userId}:example-project`,
        threadId: `seed-thread:${userId}:example-project`,
        threadName: seedExampleProjectThreadName,
      },
      {
        legacyIds: false,
        requestedGenerations: 1,
        submissionCount: 10,
        submissionId: `seed-submission:${userId}:10-submissions`,
        threadId: `seed-thread:${userId}:10-submissions`,
        threadName: "Seeded Ocean Thread - 10 Submissions",
      },
      ...additionalSeedRequestedGenerations.map((requestedGenerations) => ({
        legacyIds: false,
        requestedGenerations,
        submissionId: `seed-submission:${userId}:${requestedGenerations}-generations`,
        threadId: `seed-thread:${userId}:${requestedGenerations}-generations`,
        threadName: `Seeded Ocean Thread - ${requestedGenerations} Outputs`,
      })),
    ] satisfies SeedGenerationFixture[];

    async function seedGenerationFixture({
      fixture,
      fixtureTimestamp,
    }: {
      fixture: SeedGenerationFixture;
      fixtureTimestamp: Date;
    }) {
      const submissionCount = fixture.submissionCount ?? 1;

      if (fixture.legacyIds && submissionCount !== 1) {
        throw new Error(
          "Legacy seed fixtures must contain exactly one submission.",
        );
      }

      await tx
        .insert(schema.generationThread)
        .values({
          id: fixture.threadId,
          projectId: fixture.projectId ?? null,
          userId,
          name: fixture.threadName,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationThread.id,
          set: {
            projectId: fixture.projectId ?? null,
            userId,
            name: fixture.threadName,
            updatedAt: fixtureTimestamp,
          },
        });

      const seededSubmissionIds: string[] = [];
      const seededJobIds: string[] = [];
      const seededResultIds: string[] = [];

      for (
        let threadSubmissionIndex = 0;
        threadSubmissionIndex < submissionCount;
        threadSubmissionIndex += 1
      ) {
        const submissionId = createSeedSubmissionId({
          fixture,
          threadSubmissionIndex,
        });
        const submissionTimestamp = new Date(
          fixtureTimestamp.getTime() -
            (submissionCount - threadSubmissionIndex - 1),
        );

        await tx
          .insert(schema.generationSubmission)
          .values({
            id: submissionId,
            threadId: fixture.threadId,
            userId,
            modelId: seedModelId,
            modelSpecId: publishedSpec.id,
            submittedInput,
            requestedGenerations: fixture.requestedGenerations,
            createdAt: submissionTimestamp,
            updatedAt: submissionTimestamp,
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
              updatedAt: submissionTimestamp,
            },
          });

        seededSubmissionIds.push(submissionId);

        for (
          let submissionIndex = 0;
          submissionIndex < fixture.requestedGenerations;
          submissionIndex += 1
        ) {
          const fixtureIdSegment =
            submissionCount === 1
              ? `${fixture.requestedGenerations}-generations:${submissionIndex}`
              : `${fixture.requestedGenerations}-generations:submission-${formatSeedIndex(threadSubmissionIndex)}:${submissionIndex}`;
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
            : submissionCount === 1
              ? `seedance-dev-task-${fixture.requestedGenerations}-${formatSeedIndex(submissionIndex)}`
              : `seedance-dev-task-${fixture.requestedGenerations}-${formatSeedIndex(threadSubmissionIndex)}-${formatSeedIndex(submissionIndex)}`;
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
          await tx
            .insert(schema.generationJob)
            .values({
              id: jobId,
              submissionId,
              submissionIndex,
              status: "succeeded",
              temporalWorkflowId: `seed-workflow:${jobId}`,
              temporalRunId: `seed-run:${jobId}`,
              callbackTokenHash,
              providerId: publishedSpec.providerId,
              providerTaskId,
              providerModelId: publishedSpec.spec.providerModelId,
              terminalError: null,
              createdAt: submissionTimestamp,
              updatedAt: submissionTimestamp,
            })
            .onConflictDoUpdate({
              target: schema.generationJob.id,
              set: {
                submissionId,
                submissionIndex,
                status: "succeeded",
                temporalWorkflowId: `seed-workflow:${jobId}`,
                temporalRunId: `seed-run:${jobId}`,
                callbackTokenHash,
                providerId: publishedSpec.providerId,
                providerTaskId,
                providerModelId: publishedSpec.spec.providerModelId,
                terminalError: null,
                updatedAt: submissionTimestamp,
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
              receivedAt: submissionTimestamp,
              createdAt: submissionTimestamp,
              updatedAt: submissionTimestamp,
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
                receivedAt: submissionTimestamp,
                updatedAt: submissionTimestamp,
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
              createdAt: submissionTimestamp,
              updatedAt: submissionTimestamp,
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
                updatedAt: submissionTimestamp,
              },
            });

          await tx
            .insert(schema.generationResultPreview)
            .values({
              id: previewId,
              resultId,
              bucket: r2StorageEnv.R2_BUCKET_NAME,
              objectKey: seedPreviewObjectKey,
              contentType: seedPreviewContentType,
              contentLength: seedPreviewContentLength,
              etag: seedPreviewEtag,
              checksumSha256: seedPreviewChecksumSha256,
              frameTimeMs: 1000,
              createdAt: submissionTimestamp,
              updatedAt: submissionTimestamp,
            })
            .onConflictDoUpdate({
              target: schema.generationResultPreview.resultId,
              set: {
                bucket: r2StorageEnv.R2_BUCKET_NAME,
                objectKey: seedPreviewObjectKey,
                contentType: seedPreviewContentType,
                contentLength: seedPreviewContentLength,
                etag: seedPreviewEtag,
                checksumSha256: seedPreviewChecksumSha256,
                frameTimeMs: 1000,
                updatedAt: submissionTimestamp,
              },
            });

          seededJobIds.push(jobId);
          seededResultIds.push(resultId);
        }
      }

      return {
        threadId: fixture.threadId,
        submissionIds: seededSubmissionIds,
        requestedGenerations: fixture.requestedGenerations,
        jobIds: seededJobIds,
        resultIds: seededResultIds,
      };
    }

    async function seedPendingGenerationFixture({
      fixtureTimestamp,
    }: {
      fixtureTimestamp: Date;
    }) {
      const callbackTokenHash = createHash("sha256")
        .update(`seed-callback-token:${pendingFixture.jobId}`)
        .digest("hex");

      await tx
        .insert(schema.generationThread)
        .values({
          id: pendingFixture.threadId,
          projectId: null,
          userId,
          name: pendingFixture.threadName,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationThread.id,
          set: {
            projectId: null,
            userId,
            name: pendingFixture.threadName,
            updatedAt: fixtureTimestamp,
          },
        });

      await tx
        .insert(schema.generationSubmission)
        .values({
          id: pendingFixture.submissionId,
          threadId: pendingFixture.threadId,
          userId,
          modelId: seedModelId,
          modelSpecId: publishedSpec.id,
          submittedInput,
          requestedGenerations: pendingFixture.requestedGenerations,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationSubmission.id,
          set: {
            threadId: pendingFixture.threadId,
            userId,
            modelId: seedModelId,
            modelSpecId: publishedSpec.id,
            submittedInput,
            requestedGenerations: pendingFixture.requestedGenerations,
            updatedAt: fixtureTimestamp,
          },
        });

      await tx
        .insert(schema.generationJob)
        .values({
          id: pendingFixture.jobId,
          submissionId: pendingFixture.submissionId,
          submissionIndex: 0,
          status: "queued",
          temporalWorkflowId: `seed-workflow:${pendingFixture.jobId}`,
          temporalRunId: null,
          callbackTokenHash,
          providerId: publishedSpec.providerId,
          providerTaskId: null,
          providerModelId: publishedSpec.spec.providerModelId,
          terminalError: null,
          createdAt: fixtureTimestamp,
          updatedAt: fixtureTimestamp,
        })
        .onConflictDoUpdate({
          target: schema.generationJob.id,
          set: {
            submissionId: pendingFixture.submissionId,
            submissionIndex: 0,
            status: "queued",
            temporalWorkflowId: `seed-workflow:${pendingFixture.jobId}`,
            temporalRunId: null,
            callbackTokenHash,
            providerId: publishedSpec.providerId,
            providerTaskId: null,
            providerModelId: publishedSpec.spec.providerModelId,
            terminalError: null,
            updatedAt: fixtureTimestamp,
          },
        });

      return {
        threadId: pendingFixture.threadId,
        submissionIds: [pendingFixture.submissionId],
        requestedGenerations: pendingFixture.requestedGenerations,
        jobIds: [pendingFixture.jobId],
        resultIds: [],
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

    fixtures.push(
      await seedPendingGenerationFixture({
        fixtureTimestamp: new Date(now.getTime() - seedFixtures.length),
      }),
    );

    return {
      userId,
      fixtures,
      project: {
        id: seedExampleProjectId,
        name: seedExampleProjectName,
      },
      creditGrantAmountUsdMicros: seededCreditGrantAmountUsdMicros,
      modelSpecId: publishedSpec.id,
    };
  });

  console.log("Seeded dev data:");
  console.log(`- User: ${seedEmail} (${seeded.userId})`);
  console.log(
    seeded.creditGrantAmountUsdMicros === null
      ? "- Credit balance: existing balance preserved"
      : `- Credit balance: ${seeded.creditGrantAmountUsdMicros} USD micros`,
  );
  console.log(`- Project: ${seeded.project.name} (${seeded.project.id})`);
  for (const fixture of seeded.fixtures) {
    const generationLabel =
      fixture.requestedGenerations === 1 ? "generation" : "generations";

    console.log(
      `- Thread: ${fixture.threadId} (${fixture.requestedGenerations} ${generationLabel})`,
    );
    console.log(`  Submissions: ${fixture.submissionIds.length}`);
    console.log(`  Jobs: ${fixture.jobIds.length}`);
    console.log(`  Results: ${fixture.resultIds.length}`);
  }
  console.log(`- Model spec: ${seeded.modelSpecId}`);
} finally {
  await sql.end({ timeout: 5 });
}
