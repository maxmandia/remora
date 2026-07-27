import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";

import {
  GuestVerificationEmailNotAllowedError,
  type AuthEmailVerificationService,
} from "./auth-email-verification.service.ts";

export const verificationEmailTokenLifetimeSeconds = 60 * 60;
export const verificationEmailRateLimit = {
  max: 3,
  window: 60,
} as const;

export function createAuthEmailVerificationOptions({
  callbackUrl,
  service,
}: {
  callbackUrl: string;
  service: Pick<
    AuthEmailVerificationService,
    "authorizeSend" | "recordVerification" | "send"
  >;
}) {
  return {
    emailVerification: {
      afterEmailVerification: async (user: { id: string }) => {
        await service.recordVerification({
          occurredAt: new Date(),
          userId: user.id,
        });
      },
      autoSignInAfterVerification: true,
      expiresIn: verificationEmailTokenLifetimeSeconds,
      sendOnSignIn: false,
      sendOnSignUp: false,
      sendVerificationEmail: async ({
        user,
        url,
      }: {
        user: { email: string };
        url: string;
      }) => {
        await service.send({
          email: user.email,
          verificationUrl: url,
        });
      },
    },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path !== "/send-verification-email") {
          return;
        }

        const session = await getSessionFromCtx(context);

        if (!session) {
          throw new APIError("FORBIDDEN", {
            message: "Verification email requires an authenticated account.",
          });
        }

        try {
          await service.authorizeSend({
            callbackUrl: context.body?.callbackURL,
            expectedCallbackUrl: callbackUrl,
            requestedEmail: context.body?.email,
            sessionEmail: session.user.email,
            userId: session.user.id,
          });
        } catch (error) {
          if (error instanceof GuestVerificationEmailNotAllowedError) {
            throw new APIError("FORBIDDEN", {
              message: error.message,
            });
          }

          throw error;
        }
      }),
    },
    rateLimit: {
      customRules: {
        "/send-verification-email": verificationEmailRateLimit,
      },
    },
  };
}
