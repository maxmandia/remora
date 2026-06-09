import { setTimeout as sleep } from "node:timers/promises";

import { NativeConnection } from "@temporalio/worker";

type TemporalConnectionRetryOptions = {
  address: string;
  maxAttempts?: number;
  retryDelayMs?: number;
};

export async function connectTemporalWithRetry({
  address,
  maxAttempts = 30,
  retryDelayMs = 1_000,
}: TemporalConnectionRetryOptions): Promise<NativeConnection> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await NativeConnection.connect({ address });
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Unable to connect to Temporal at ${address}`, {
    cause: lastError,
  });
}
