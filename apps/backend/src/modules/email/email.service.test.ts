import { describe, expect, it, vi } from "vitest";

import { EmailService } from "./email.service.ts";

describe("verification email service", () => {
  it("builds and delivers the provider-neutral message", async () => {
    const provider = {
      deliver: vi.fn().mockResolvedValue({
        providerMessageId: "message_1",
        status: "queued",
      }),
    };
    const service = new EmailService(provider);

    await expect(
      service.sendVerificationEmail({
        email: "user@example.test",
        verificationUrl:
          "https://api.example.test/api/auth/verify-email?token=secret",
      }),
    ).resolves.toEqual({
      providerMessageId: "message_1",
      status: "queued",
    });
    expect(provider.deliver).toHaveBeenCalledWith({
      to: "user@example.test",
      subject: "Verify your email to continue with your generation",
      text: expect.stringContaining("https://api.example.test/"),
      html: expect.stringContaining(">Verify email</a>"),
    });
  });
});
