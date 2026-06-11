import { describe, expect, it } from "vitest";

import {
  parseBackendAuthEnv,
  parseBackendHttpEnv,
  parseBackendWorkerEnv,
  parseBytePlusProviderEnv,
  parseR2StorageEnv,
} from "./index.ts";

const defaultClientOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "app.remora.desktop:/",
];

const authSecret = "replace-with-at-least-32-random-characters";

describe("client origins", () => {
  it("defaults the public API origin for local callback development", () => {
    expect(parseBackendHttpEnv({}).API_PUBLIC_ORIGIN).toBe(
      "http://localhost:4000",
    );
  });

  it("defaults API CORS and auth trusted origins to web and desktop clients", () => {
    expect(parseBackendHttpEnv({}).API_CORS_ORIGINS).toEqual(
      defaultClientOrigins,
    );
    expect(
      parseBackendAuthEnv({
        BETTER_AUTH_SECRET: authSecret,
      }).CLIENT_TRUSTED_ORIGINS,
    ).toEqual(defaultClientOrigins);
  });

  it("adds explicit CSV origins to the defaults", () => {
    expect(
      parseBackendHttpEnv({
        API_CORS_ORIGINS:
          "http://localhost:5173, https://staging.remora.example",
      }).API_CORS_ORIGINS,
    ).toEqual([
      ...defaultClientOrigins,
      "http://localhost:5173",
      "https://staging.remora.example",
    ]);

    expect(
      parseBackendAuthEnv({
        BETTER_AUTH_SECRET: authSecret,
        CLIENT_TRUSTED_ORIGINS: "https://staging.remora.example",
      }).CLIENT_TRUSTED_ORIGINS,
    ).toEqual([...defaultClientOrigins, "https://staging.remora.example"]);
  });

  it("dedupes repeated default and CSV origins", () => {
    expect(
      parseBackendHttpEnv({
        API_CORS_ORIGINS: [
          "http://localhost:3000",
          "http://localhost:3000",
          "https://staging.remora.example",
          "https://staging.remora.example",
        ].join(","),
      }).API_CORS_ORIGINS,
    ).toEqual([...defaultClientOrigins, "https://staging.remora.example"]);
  });
});

describe("backend worker env", () => {
  it("defaults Temporal local development settings", () => {
    expect(parseBackendWorkerEnv({})).toEqual({
      API_PUBLIC_ORIGIN: "http://localhost:4000",
      WORKER_HEALTH_PORT: 4001,
      TEMPORAL_ADDRESS: "localhost:7233",
      TEMPORAL_NAMESPACE: "default",
      TEMPORAL_TASK_QUEUE: "remora-backend",
    });
  });
});

describe("BytePlus provider env", () => {
  it("requires an API key and defaults the ModelArk base URL", () => {
    expect(
      parseBytePlusProviderEnv({
        BYTEPLUS_ARK_API_KEY: "ark-test-key",
      }),
    ).toEqual({
      BYTEPLUS_ARK_API_KEY: "ark-test-key",
      BYTEPLUS_ARK_BASE_URL: "https://ark.ap-southeast.bytepluses.com/api/v3",
    });
  });

  it("allows overriding the ModelArk base URL", () => {
    expect(
      parseBytePlusProviderEnv({
        BYTEPLUS_ARK_API_KEY: "ark-test-key",
        BYTEPLUS_ARK_BASE_URL: "https://ark.example.test/api/v3",
      }).BYTEPLUS_ARK_BASE_URL,
    ).toBe("https://ark.example.test/api/v3");
  });

  it("rejects missing API keys", () => {
    expect(() => parseBytePlusProviderEnv({})).toThrow();
  });
});

describe("R2 storage env", () => {
  const requiredR2Env = {
    R2_ACCOUNT_ID: "account-id",
    R2_ACCESS_KEY_ID: "access-key-id",
    R2_SECRET_ACCESS_KEY: "secret-access-key",
    R2_BUCKET_NAME: "remora-generations",
  };

  it("requires storage credentials and defaults storage options", () => {
    expect(parseR2StorageEnv(requiredR2Env)).toEqual({
      ...requiredR2Env,
      R2_SIGNED_URL_TTL_SECONDS: 900,
    });
  });

  it("allows overriding the signed URL TTL", () => {
    expect(
      parseR2StorageEnv({
        ...requiredR2Env,
        R2_SIGNED_URL_TTL_SECONDS: "300",
      }),
    ).toEqual({
      ...requiredR2Env,
      R2_SIGNED_URL_TTL_SECONDS: 300,
    });
  });

  it("rejects missing required storage credentials", () => {
    expect(() => parseR2StorageEnv({})).toThrow();
  });
});
