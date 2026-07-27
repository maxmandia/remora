import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import {
  createGuestGenerationDraft,
  validateStoredGuestGenerationDraft,
  type CreateGuestGenerationDraftInput,
  type GuestGenerationDraftV1,
} from "./guest-generation-draft";

export const guestGenerationDraftDatabaseName = "remora-guest-generation";
export const guestGenerationDraftObjectStoreName = "drafts";
export const currentGuestGenerationDraftKey = "current";

const guestGenerationDraftDatabaseVersion = 1;

interface GuestGenerationDraftDatabase extends DBSchema {
  drafts: {
    key: typeof currentGuestGenerationDraftKey;
    value: unknown;
  };
}

export type GuestGenerationDraftStorageFailureReason =
  | "quota-exceeded"
  | "storage-error"
  | "unavailable";

export type SaveGuestGenerationDraftResult =
  | {
      draft: GuestGenerationDraftV1;
      status: "saved";
    }
  | {
      reason: "invalid-draft";
      status: "rejected";
    }
  | {
      reason: GuestGenerationDraftStorageFailureReason;
      status: "failed";
    };

export type ReadGuestGenerationDraftResult =
  | {
      draft: GuestGenerationDraftV1;
      status: "found";
    }
  | {
      status: "empty";
    }
  | {
      reason: "expired" | "incompatible" | "malformed";
      status: "discarded";
    }
  | {
      reason: Exclude<
        GuestGenerationDraftStorageFailureReason,
        "quota-exceeded"
      >;
      status: "failed";
    };

export type ClearGuestGenerationDraftResult =
  | {
      status: "cleared";
    }
  | {
      reason: Exclude<
        GuestGenerationDraftStorageFailureReason,
        "quota-exceeded"
      >;
      status: "failed";
    };

export interface GuestGenerationDraftRepository {
  clear(): Promise<ClearGuestGenerationDraftResult>;
  read(
    models: PublishedGenerationModelSummary[],
  ): Promise<ReadGuestGenerationDraftResult>;
  save(
    input: CreateGuestGenerationDraftInput,
  ): Promise<SaveGuestGenerationDraftResult>;
}

export function createGuestGenerationDraftRepository({
  now = Date.now,
}: {
  now?: () => number;
} = {}): GuestGenerationDraftRepository {
  return {
    async save(input) {
      const snapshot = createGuestGenerationDraft({
        input,
        now: now(),
      });

      if (snapshot.status === "invalid") {
        return {
          reason: "invalid-draft",
          status: "rejected",
        };
      }

      try {
        await withGuestGenerationDraftDatabase(async (database) => {
          await database.put(
            guestGenerationDraftObjectStoreName,
            snapshot.draft,
            currentGuestGenerationDraftKey,
          );
        });

        return {
          draft: snapshot.draft,
          status: "saved",
        };
      } catch (error) {
        return {
          reason: classifyStorageFailure(error, true),
          status: "failed",
        };
      }
    },

    async read(models) {
      try {
        return await withGuestGenerationDraftDatabase(async (database) => {
          const transaction = database.transaction(
            guestGenerationDraftObjectStoreName,
            "readwrite",
          );
          const storedDraft = await transaction.store.get(
            currentGuestGenerationDraftKey,
          );

          if (storedDraft === undefined) {
            await transaction.done;
            return { status: "empty" };
          }

          const validation = validateStoredGuestGenerationDraft({
            models,
            now: now(),
            value: storedDraft,
          });

          if (validation.status === "invalid") {
            await transaction.store.delete(currentGuestGenerationDraftKey);
            await transaction.done;

            return {
              reason: validation.reason,
              status: "discarded",
            };
          }

          await transaction.done;

          return {
            draft: validation.draft,
            status: "found",
          };
        });
      } catch (error) {
        return {
          reason: classifyStorageFailure(error, false),
          status: "failed",
        };
      }
    },

    async clear() {
      try {
        await withGuestGenerationDraftDatabase(async (database) => {
          await database.delete(
            guestGenerationDraftObjectStoreName,
            currentGuestGenerationDraftKey,
          );
        });

        return { status: "cleared" };
      } catch (error) {
        return {
          reason: classifyStorageFailure(error, false),
          status: "failed",
        };
      }
    },
  };
}

export const guestGenerationDraftRepository =
  createGuestGenerationDraftRepository();

async function openGuestGenerationDraftDatabase() {
  if (typeof indexedDB === "undefined") {
    throw new GuestGenerationDraftStorageUnavailableError();
  }

  return openDB<GuestGenerationDraftDatabase>(
    guestGenerationDraftDatabaseName,
    guestGenerationDraftDatabaseVersion,
    {
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBDatabase | null)?.close();
      },
      upgrade(database) {
        if (
          !database.objectStoreNames.contains(
            guestGenerationDraftObjectStoreName,
          )
        ) {
          database.createObjectStore(guestGenerationDraftObjectStoreName);
        }
      },
    },
  );
}

async function withGuestGenerationDraftDatabase<Result>(
  operation: (
    database: IDBPDatabase<GuestGenerationDraftDatabase>,
  ) => Promise<Result>,
) {
  const database = await openGuestGenerationDraftDatabase();

  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

function classifyStorageFailure(
  error: unknown,
  includeQuotaExceeded: true,
): GuestGenerationDraftStorageFailureReason;
function classifyStorageFailure(
  error: unknown,
  includeQuotaExceeded: false,
): Exclude<GuestGenerationDraftStorageFailureReason, "quota-exceeded">;
function classifyStorageFailure(
  error: unknown,
  includeQuotaExceeded: boolean,
): GuestGenerationDraftStorageFailureReason {
  const errorName = error instanceof DOMException ? error.name : undefined;

  if (includeQuotaExceeded && errorName === "QuotaExceededError") {
    return "quota-exceeded";
  }

  if (
    error instanceof GuestGenerationDraftStorageUnavailableError ||
    errorName === "SecurityError" ||
    errorName === "InvalidStateError" ||
    errorName === "NotSupportedError"
  ) {
    return "unavailable";
  }

  return "storage-error";
}

class GuestGenerationDraftStorageUnavailableError extends Error {
  constructor() {
    super("IndexedDB is unavailable.");
    this.name = "GuestGenerationDraftStorageUnavailableError";
  }
}
