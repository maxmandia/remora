import { describe, expect, it } from "vitest";

import { createVerificationEmailContent } from "./email.utils.ts";

describe("verification email content", () => {
  it("renders matching plain-text and HTML verification messages", () => {
    const verificationUrl =
      "https://api.remora.test/api/auth/verify-email?token=secret&callbackURL=https%3A%2F%2Fremora.test%2Fcheck-email";
    const content = createVerificationEmailContent(verificationUrl);

    expect(content.subject).toBe(
      "Verify your email to continue with your generation",
    );
    expect(content.text).toContain(verificationUrl);
    expect(content.text).toContain("expires in one hour");
    expect(content.html).toContain(
      "https://api.remora.test/api/auth/verify-email?token=secret&amp;callbackURL=",
    );
    expect(content.html).toContain(">Verify email</a>");
    expect(content.html).toContain("expires in one hour");
  });
});
