import { describe, expect, it } from "vitest";

import {
  parseBackendAuthEnv,
  parseBackendHttpEnv,
  parseBackendObservabilityEnv,
  parseBackendWorkerEnv,
  parseBytePlusProviderEnv,
  parseDesktopEnv,
  parseDesktopSentryBuildEnv,
  parseR2StorageEnv,
  parseStripeWebhookEnv,
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

  it("uses Railway's PORT for the backend HTTP listener when API_PORT is absent", () => {
    expect(parseBackendHttpEnv({ PORT: "5100" }).API_PORT).toBe(5100);
  });

  it("lets API_PORT override Railway's PORT for the backend HTTP listener", () => {
    expect(
      parseBackendHttpEnv({ API_PORT: "4000", PORT: "5100" }).API_PORT,
    ).toBe(4000);
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

  it("requires backend release web origins instead of deriving them from the desktop channel", () => {
    expect(() =>
      parseBackendHttpEnv({
        DESKTOP_CHANNEL: "nightly",
      }),
    ).toThrow("WEB_ORIGIN");

    expect(() =>
      parseBackendAuthEnv({
        BETTER_AUTH_SECRET: authSecret,
        DESKTOP_CHANNEL: "nightly",
      }),
    ).toThrow("WEB_ORIGIN");
  });

  it("uses explicit backend release web origins with channel protocol defaults", () => {
    expect(
      parseBackendHttpEnv({
        DESKTOP_CHANNEL: "nightly",
        WEB_ORIGIN: "https://web.example.test",
      }).API_CORS_ORIGINS,
    ).toEqual([
      "https://web.example.test",
      "http://localhost:3001",
      "app.remora.desktop.nightly:/",
    ]);

    expect(
      parseBackendAuthEnv({
        BETTER_AUTH_SECRET: authSecret,
        DESKTOP_CHANNEL: "nightly",
        WEB_ORIGIN: "https://web.example.test",
      }).CLIENT_TRUSTED_ORIGINS,
    ).toEqual([
      "https://web.example.test",
      "http://localhost:3001",
      "app.remora.desktop.nightly:/",
    ]);
  });
});

describe("desktop env", () => {
  it("defaults to the existing local desktop configuration", () => {
    expect(parseDesktopEnv({})).toEqual({
      DESKTOP_CHANNEL: "local",
      DESKTOP_APP_NAME: "Remora",
      DESKTOP_BUNDLE_ID: "com.electron.remora",
      DESKTOP_API_ORIGIN: "http://localhost:4000",
      DESKTOP_DEV_ORIGIN: "http://localhost:3001",
      DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop",
      DESKTOP_SENTRY_DSN: null,
      SENTRY_ENVIRONMENT: "local",
      SENTRY_RELEASE: null,
      WEB_ORIGIN: "http://localhost:3000",
    });
  });

  it("requires release desktop origins instead of deriving them from the channel", () => {
    expect(() =>
      parseDesktopEnv({
        DESKTOP_CHANNEL: "nightly",
      }),
    ).toThrow("DESKTOP_API_ORIGIN or API_PUBLIC_ORIGIN");

    expect(() =>
      parseDesktopEnv({
        DESKTOP_CHANNEL: "nightly",
        API_PUBLIC_ORIGIN: "https://api.example.test",
      }),
    ).toThrow("WEB_ORIGIN");
  });

  it("resolves nightly channel identity with Railway release origins", () => {
    expect(
      parseDesktopEnv({
        DESKTOP_CHANNEL: "nightly",
        API_PUBLIC_ORIGIN: "https://api.example.test",
        WEB_ORIGIN: "https://web.example.test",
      }),
    ).toEqual({
      DESKTOP_CHANNEL: "nightly",
      DESKTOP_APP_NAME: "Remora Nightly",
      DESKTOP_BUNDLE_ID: "app.remora.desktop.nightly",
      DESKTOP_API_ORIGIN: "https://api.example.test",
      DESKTOP_DEV_ORIGIN: "http://localhost:3001",
      DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop.nightly",
      DESKTOP_SENTRY_DSN: null,
      SENTRY_ENVIRONMENT: "staging",
      SENTRY_RELEASE: null,
      WEB_ORIGIN: "https://web.example.test",
    });
  });

  it("resolves stable channel identity with explicit release origins", () => {
    expect(
      parseDesktopEnv({
        DESKTOP_CHANNEL: "stable",
        DESKTOP_API_ORIGIN: "https://api.example.test",
        WEB_ORIGIN: "https://web.example.test",
      }),
    ).toEqual({
      DESKTOP_CHANNEL: "stable",
      DESKTOP_APP_NAME: "Remora",
      DESKTOP_BUNDLE_ID: "app.remora.desktop",
      DESKTOP_API_ORIGIN: "https://api.example.test",
      DESKTOP_DEV_ORIGIN: "http://localhost:3001",
      DESKTOP_PROTOCOL_SCHEME: "app.remora.desktop",
      DESKTOP_SENTRY_DSN: null,
      SENTRY_ENVIRONMENT: "production",
      SENTRY_RELEASE: null,
      WEB_ORIGIN: "https://web.example.test",
    });
  });

  it("allows release environment overrides without changing the channel", () => {
    expect(
      parseDesktopEnv({
        DESKTOP_CHANNEL: "nightly",
        DESKTOP_API_ORIGIN: "https://api.preview.remora.test",
        WEB_ORIGIN: "https://preview.remora.test",
      }),
    ).toMatchObject({
      DESKTOP_CHANNEL: "nightly",
      DESKTOP_APP_NAME: "Remora Nightly",
      DESKTOP_API_ORIGIN: "https://api.preview.remora.test",
      WEB_ORIGIN: "https://preview.remora.test",
    });
  });

  it("parses optional desktop Sentry runtime settings", () => {
    expect(
      parseDesktopEnv({
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
        SENTRY_ENVIRONMENT: "preview",
        SENTRY_RELEASE: "remora-desktop@1.2.3",
      }),
    ).toMatchObject({
      DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
      SENTRY_ENVIRONMENT: "preview",
      SENTRY_RELEASE: "remora-desktop@1.2.3",
    });
  });
});

describe("backend observability env", () => {
  it("defaults Sentry settings to disabled local observability", () => {
    expect(parseBackendObservabilityEnv({})).toEqual({
      SENTRY_DSN: null,
      SENTRY_ENVIRONMENT: "local",
      SENTRY_RELEASE: null,
      SENTRY_TRACE_URL_TEMPLATE: null,
    });
  });

  it("prefers explicit Sentry environment before Railway and Node environment", () => {
    expect(
      parseBackendObservabilityEnv({
        NODE_ENV: "production",
        RAILWAY_ENVIRONMENT_NAME: "staging",
        SENTRY_ENVIRONMENT: "preview",
        SENTRY_DSN: "https://backend@example.test/1",
        SENTRY_RELEASE: "remora-backend@1.2.3",
        SENTRY_TRACE_URL_TEMPLATE: "https://grafana.example.test/{traceId}",
      }),
    ).toEqual({
      SENTRY_DSN: "https://backend@example.test/1",
      SENTRY_ENVIRONMENT: "preview",
      SENTRY_RELEASE: "remora-backend@1.2.3",
      SENTRY_TRACE_URL_TEMPLATE: "https://grafana.example.test/{traceId}",
    });
  });

  it("falls back from Railway environment to Node environment", () => {
    expect(
      parseBackendObservabilityEnv({
        NODE_ENV: "test",
      }).SENTRY_ENVIRONMENT,
    ).toBe("test");

    expect(
      parseBackendObservabilityEnv({
        NODE_ENV: "production",
        RAILWAY_ENVIRONMENT_NAME: "staging",
      }).SENTRY_ENVIRONMENT,
    ).toBe("staging");
  });
});

describe("desktop Sentry build env", () => {
  it("skips source map upload for local builds", () => {
    expect(
      parseDesktopSentryBuildEnv({
        DESKTOP_CHANNEL: "local",
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
      }),
    ).toEqual({
      enabled: false,
      org: null,
      project: null,
      authToken: null,
    });
  });

  it("requires source map upload credentials when release Sentry is enabled", () => {
    expect(() =>
      parseDesktopSentryBuildEnv({
        DESKTOP_CHANNEL: "nightly",
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
      }),
    ).toThrow("SENTRY_ORG");

    expect(() =>
      parseDesktopSentryBuildEnv({
        DESKTOP_CHANNEL: "stable",
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
        SENTRY_ORG: "remora",
      }),
    ).toThrow("SENTRY_DESKTOP_PROJECT");

    expect(() =>
      parseDesktopSentryBuildEnv({
        DESKTOP_CHANNEL: "stable",
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
        SENTRY_ORG: "remora",
        SENTRY_DESKTOP_PROJECT: "remora-desktop",
      }),
    ).toThrow("SENTRY_AUTH_TOKEN");
  });

  it("enables source map upload for configured release builds", () => {
    expect(
      parseDesktopSentryBuildEnv({
        DESKTOP_CHANNEL: "stable",
        DESKTOP_SENTRY_DSN: "https://desktop@example.test/1",
        SENTRY_AUTH_TOKEN: "token",
        SENTRY_ORG: "remora",
        SENTRY_DESKTOP_PROJECT: "remora-desktop",
      }),
    ).toEqual({
      enabled: true,
      org: "remora",
      project: "remora-desktop",
      authToken: "token",
    });
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

  it("uses Railway's PORT for the worker health listener when WORKER_HEALTH_PORT is absent", () => {
    expect(parseBackendWorkerEnv({ PORT: "5101" }).WORKER_HEALTH_PORT).toBe(
      5101,
    );
  });

  it("lets WORKER_HEALTH_PORT override Railway's PORT for the worker health listener", () => {
    expect(
      parseBackendWorkerEnv({ PORT: "5101", WORKER_HEALTH_PORT: "4001" })
        .WORKER_HEALTH_PORT,
    ).toBe(4001);
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

describe("Stripe webhook env", () => {
  it("requires a webhook signing secret", () => {
    expect(
      parseStripeWebhookEnv({
        STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
      }),
    ).toEqual({
      STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
    });

    expect(() => parseStripeWebhookEnv({})).toThrow();
  });
});
