import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { electron } from "@better-auth/electron";
import { betterAuth } from "better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";

import { parseBackendAuthEnv } from "@remora/env";

import { db, schema } from "../../db/client.ts";
import { authService } from "./auth.service.ts";

const env = parseBackendAuthEnv(process.env);

export const auth = betterAuth({
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
          await authService.initBillingForCreatedUser({
            userId: user.id,
            email: user.email,
            name: user.name ?? null,
            logger: context?.context.logger,
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
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
