import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { electron } from "@better-auth/electron"
import { betterAuth } from "better-auth"
import { fromNodeHeaders } from "better-auth/node"
import type { IncomingHttpHeaders } from "node:http"

import { db, schema } from "@remora/db"
import { parseAuthEnv } from "@remora/env"

const env = parseAuthEnv(process.env)

export const auth = betterAuth({
  appName: "Remora",
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.CLIENT_TRUSTED_ORIGINS,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    electron({
      clientID: "electron",
    }),
  ],
  secret: env.BETTER_AUTH_SECRET,
})

export const getSessionFromHeaders = (headers: IncomingHttpHeaders) =>
  auth.api.getSession({
    headers: fromNodeHeaders(headers),
  })

export type Session = typeof auth.$Infer.Session.session
export type User = typeof auth.$Infer.Session.user

type SerializedValue<T> = T extends Date ? string : T

export type SerializedUser = {
  [Key in keyof User]: SerializedValue<User[Key]>
}
