import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify from "fastify";

import { parseBackendHttpEnv } from "@remora/env";

import { handleAuthRequest } from "../modules/auth/auth.http.ts";
import { registerStripeWebhookRoutes } from "../modules/credits/credits.router.ts";
import { registerGenerationCallbackRoutes } from "../modules/generation/generation.router.ts";
import { registerGenerationAttachmentMediaUploadRoutes } from "../modules/generation-attachment-media/generation-attachment-media.router.ts";
import { registerRealtimeRoutes } from "../modules/realtime/realtime.router.ts";
import { appRouter, createTRPCContext } from "../trpc/index.ts";

const env = parseBackendHttpEnv(process.env);

const server = Fastify({
  logger: true,
});

await server.register(websocket, {
  options: {
    maxPayload: 1024,
  },
});

await server.register(multipart, {
  limits: {
    fileSize: 60 * 1024 * 1024,
    files: 1,
  },
});

await server.register(cors, {
  origin(origin, callback) {
    callback(null, !origin || env.API_CORS_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});

server.get("/healthz", async () => ({
  ok: true,
  service: "backend-http",
}));

await registerRealtimeRoutes(server, {
  allowedOrigins: env.API_CORS_ORIGINS,
});

server.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  handler: (request, reply) => handleAuthRequest(request, reply, env.API_PORT),
});

await registerGenerationCallbackRoutes(server);
await registerGenerationAttachmentMediaUploadRoutes(server);
await registerStripeWebhookRoutes(server);

await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext: createTRPCContext,
  },
});

await server.listen({
  host: "0.0.0.0",
  port: env.API_PORT,
});
