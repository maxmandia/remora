import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";

import { parseBackendAuthEnv, parseBackendEmailEnv } from "@remora/env";

import {
  authEmailVerificationService,
  authService,
} from "../../app.service.ts";
import { db, schema } from "../../db/client.ts";
import { createAuthEmailVerificationOptions } from "./auth-email-verification.utils.ts";

const env = parseBackendAuthEnv(process.env);
parseBackendEmailEnv(process.env);
const verificationEmailCallbackUrl = new URL(
  "/check-email?verified=true",
  env.WEB_ORIGIN,
).toString();
const emailVerificationOptions = createAuthEmailVerificationOptions({
  callbackUrl: verificationEmailCallbackUrl,
  service: authEmailVerificationService,
});

export const auth = betterAuth({
  ...emailVerificationOptions,
  appName: "Remora",
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.CLIENT_TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          await authService.completeSignup({
            userId: user.id,
            email: user.email,
            name: user.name ?? null,
            occurredAt: user.createdAt,
            logger: context?.context.logger,
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        defaultValue: false,
        input: false,
        required: true,
      },
    },
  },
  plugins: [
    electron({
      clientID: "electron",
    }),
  ],
  secret: env.BETTER_AUTH_SECRET,
});

export const getSessionFromHeaders = (headers: IncomingHttpHeaders) =>
  auth.api.getSession({
    headers: fromNodeHeaders(headers),
  });

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
