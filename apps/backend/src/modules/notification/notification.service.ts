import {
  parseBackendNotificationEnv,
  type BackendNotificationEnv,
} from "@remora/env";

import {
  captureObservabilityException,
  logObservabilityEvent,
  toErrorLogFields,
} from "../observability/observability.service.ts";
import type {
  AccountSignedUpNotification,
  NotificationPublisher,
} from "./notification.types.ts";

type NotificationFailureStage = "delivery" | "initialization";

type NotificationServiceDependencies = {
  createTimeoutSignal: (timeoutMs: number) => AbortSignal;
  fetcher: typeof fetch;
  getConfig: () => BackendNotificationEnv;
  reportError: (
    stage: NotificationFailureStage,
    error: unknown,
    fields?: Record<string, unknown>,
  ) => void;
};

const discordMarkdownCharacters = "\\`*_{}[]()#+-.!|>~";
const deliveryTimeoutMs = 3_000;

const defaultDependencies: NotificationServiceDependencies = {
  createTimeoutSignal: (timeoutMs) => AbortSignal.timeout(timeoutMs),
  fetcher: fetch,
  getConfig: () => parseBackendNotificationEnv(process.env),
  reportError: (stage, error, fields = {}) => {
    const observabilityFields = {
      ...toErrorLogFields(error),
      ...fields,
      notificationChannel: "discord",
      notificationType: "account_signed_up",
    };

    logObservabilityEvent(
      `signup_notification_${stage}_failed`,
      observabilityFields,
      { level: "error" },
    );
    captureObservabilityException(error, observabilityFields);
  },
};

export class NotificationService implements NotificationPublisher {
  private readonly dependencies: NotificationServiceDependencies;
  private initialized = false;
  private webhookUrl: string | null = null;

  constructor(dependencies: Partial<NotificationServiceDependencies> = {}) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies,
    };
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    try {
      this.webhookUrl =
        this.dependencies.getConfig().DISCORD_SIGNUP_WEBHOOK_URL;
    } catch (error) {
      this.reportError("initialization", error);
    }
  }

  notifyAccountSignedUp(input: AccountSignedUpNotification): void {
    const webhookUrl = this.webhookUrl;

    if (!webhookUrl) {
      return;
    }

    void this.deliverAccountSignedUp(input, webhookUrl).catch((error) => {
      this.reportError("delivery", error, {
        userId: input.userId,
      });
    });
  }

  private async deliverAccountSignedUp(
    input: AccountSignedUpNotification,
    configuredWebhookUrl: string,
  ): Promise<void> {
    const webhookUrl = new URL(configuredWebhookUrl);
    webhookUrl.searchParams.set("wait", "true");

    const response = await this.dependencies.fetcher(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.createAccountSignedUpPayload(input)),
      signal: this.dependencies.createTimeoutSignal(deliveryTimeoutMs),
    });

    if (!response.ok) {
      throw new DiscordWebhookResponseError(response.status);
    }
  }

  private createAccountSignedUpPayload(input: AccountSignedUpNotification) {
    return {
      username: "Remora Notifications",
      allowed_mentions: {
        parse: [],
      },
      embeds: [
        {
          title: "New Remora signup",
          fields: [
            {
              name: "Name",
              value: this.escapeDiscordMarkdown(input.name ?? "Not provided"),
              inline: true,
            },
            {
              name: "Email",
              value: this.escapeDiscordMarkdown(input.email),
              inline: true,
            },
            {
              name: "User ID",
              value: this.escapeDiscordMarkdown(input.userId),
              inline: false,
            },
          ],
          timestamp: input.occurredAt.toISOString(),
        },
      ],
    };
  }

  private escapeDiscordMarkdown(value: string): string {
    return [...value]
      .map((character) =>
        discordMarkdownCharacters.includes(character)
          ? `\\${character}`
          : character,
      )
      .join("");
  }

  private reportError(
    stage: NotificationFailureStage,
    error: unknown,
    fields?: Record<string, unknown>,
  ): void {
    try {
      this.dependencies.reportError(stage, error, fields);
    } catch {
      // Notifications and their error reporting must never affect signup.
    }
  }
}

class DiscordWebhookResponseError extends Error {
  constructor(readonly statusCode: number) {
    super(`Discord signup notification failed with HTTP ${statusCode}`);
    this.name = "DiscordWebhookResponseError";
  }
}

export const notificationService = new NotificationService();
