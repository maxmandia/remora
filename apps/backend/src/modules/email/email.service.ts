import { cloudflareVerificationEmailProvider } from "./providers/cloudflare/cloudflare-email.service.ts";
import type {
  VerificationEmailDeliveryResult,
  VerificationEmailProvider,
} from "./email.types.ts";
import { createVerificationEmailContent } from "./email.utils.ts";

export class EmailService {
  constructor(
    private readonly provider: VerificationEmailProvider = cloudflareVerificationEmailProvider,
  ) {}

  async sendVerificationEmail({
    email,
    verificationUrl,
  }: {
    email: string;
    verificationUrl: string;
  }): Promise<VerificationEmailDeliveryResult> {
    const content = createVerificationEmailContent(verificationUrl);

    return this.provider.deliver({
      ...content,
      to: email,
    });
  }
}
