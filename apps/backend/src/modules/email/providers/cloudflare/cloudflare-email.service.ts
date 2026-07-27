import { parseBackendEmailEnv, type BackendEmailEnv } from "@remora/env";
import { z } from "zod";

import {
  VerificationEmailConfigurationError,
  VerificationEmailDeliveryError,
  type VerificationEmailDeliveryResult,
  type VerificationEmailMessage,
  type VerificationEmailProvider,
} from "../../email.types.ts";

const cloudflareEmailApiOrigin = "https://api.cloudflare.com";
const deliveryTimeoutMs = 5_000;
const cloudflareEmailResponseSchema = z.object({
  success: z.boolean(),
  result: z
    .object({
      delivered: z.array(z.string()),
      message_id: z.string().optional(),
      permanent_bounces: z.array(z.string()),
      queued: z.array(z.string()),
    })
    .nullable(),
});
const cloudflareEmailErrorResponseSchema = z.object({
  errors: z.array(
    z.object({
      code: z.number(),
    }),
  ),
});

type CloudflareVerificationEmailProviderDependencies = {
  createTimeoutSignal: (timeoutMs: number) => AbortSignal;
  fetcher: typeof fetch;
  getConfig: () => BackendEmailEnv;
};

const defaultDependencies: CloudflareVerificationEmailProviderDependencies = {
  createTimeoutSignal: (timeoutMs) => AbortSignal.timeout(timeoutMs),
  fetcher: fetch,
  getConfig: () => parseBackendEmailEnv(process.env),
};

export class CloudflareVerificationEmailProvider implements VerificationEmailProvider {
  private readonly dependencies: CloudflareVerificationEmailProviderDependencies;

  constructor(
    dependencies: Partial<CloudflareVerificationEmailProviderDependencies> = {},
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies,
    };
  }

  async deliver(
    message: VerificationEmailMessage,
  ): Promise<VerificationEmailDeliveryResult> {
    const config = this.getConfig();
    const endpoint = new URL(
      `/client/v4/accounts/${encodeURIComponent(config.accountId)}/email/sending/send`,
      cloudflareEmailApiOrigin,
    );

    let response: Response;

    try {
      response = await this.dependencies.fetcher(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: message.to,
          from: formatSender(config.senderAddress, config.senderName),
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
        signal: this.dependencies.createTimeoutSignal(deliveryTimeoutMs),
      });
    } catch (error) {
      throw new VerificationEmailDeliveryError(
        isTimeoutError(error) ? "timeout" : "provider-error",
      );
    }

    if (!response.ok) {
      const errorPayload = cloudflareEmailErrorResponseSchema.safeParse(
        await readJson(response),
      );

      throw new VerificationEmailDeliveryError(
        "provider-error",
        response.status,
        errorPayload.success
          ? (errorPayload.data.errors[0]?.code ?? null)
          : null,
      );
    }

    let payload: z.infer<typeof cloudflareEmailResponseSchema>;

    try {
      payload = cloudflareEmailResponseSchema.parse(await response.json());
    } catch {
      throw new VerificationEmailDeliveryError("invalid-response");
    }

    if (!payload.success || !payload.result) {
      throw new VerificationEmailDeliveryError("provider-error");
    }

    const normalizedRecipient = message.to.toLowerCase();
    const permanentlyBounced = payload.result.permanent_bounces.some(
      (email) => email.toLowerCase() === normalizedRecipient,
    );

    if (permanentlyBounced) {
      throw new VerificationEmailDeliveryError("permanent-bounce");
    }

    const status = payload.result.delivered.some(
      (email) => email.toLowerCase() === normalizedRecipient,
    )
      ? "delivered"
      : payload.result.queued.some(
            (email) => email.toLowerCase() === normalizedRecipient,
          )
        ? "queued"
        : payload.result.message_id
          ? "queued"
          : null;

    if (!status) {
      throw new VerificationEmailDeliveryError("invalid-response");
    }

    return {
      providerMessageId: payload.result.message_id ?? null,
      status,
    };
  }

  private getConfig() {
    const config = this.dependencies.getConfig();

    if (
      !config.CLOUDFLARE_EMAIL_ACCOUNT_ID ||
      !config.CLOUDFLARE_EMAIL_API_TOKEN ||
      !config.CLOUDFLARE_EMAIL_SENDER_ADDRESS ||
      !config.CLOUDFLARE_EMAIL_SENDER_NAME
    ) {
      throw new VerificationEmailConfigurationError();
    }

    return {
      accountId: config.CLOUDFLARE_EMAIL_ACCOUNT_ID,
      apiToken: config.CLOUDFLARE_EMAIL_API_TOKEN,
      senderAddress: config.CLOUDFLARE_EMAIL_SENDER_ADDRESS,
      senderName: config.CLOUDFLARE_EMAIL_SENDER_NAME,
    };
  }
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function formatSender(address: string, name: string) {
  const escapedName = name.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  return `"${escapedName}" <${address}>`;
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export const cloudflareVerificationEmailProvider =
  new CloudflareVerificationEmailProvider();
