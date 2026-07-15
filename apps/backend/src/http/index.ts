import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyBaseLogger } from "fastify";
import Fastify from "fastify";

import { parseBackendHttpEnv } from "@remora/env";

import { handleAuthRequest } from "../modules/auth/auth.http.ts";
import { analyticsService } from "../modules/analytics/analytics.service.ts";
import { registerStripeWebhookRoutes } from "../modules/credits/credits.router.ts";
import { registerGenerationAttachmentMediaUploadRoutes } from "../modules/generation-attachment-media/generation-attachment-media.router.ts";
import { registerGenerationCallbackRoutes } from "../modules/generation/generation.router.ts";
import {
  captureObservabilityException,
  getActiveTraceResponseHeaders,
  initializeObservability,
  registerProcessErrorCapture,
  shutdownObservability,
} from "../modules/observability/observability.service.ts";
import { registerRealtimeRoutes } from "../modules/realtime/realtime.router.ts";
import { appRouter, createTRPCContext } from "../trpc/index.ts";
import { httpRouterOptions } from "./http.utils.ts";

const env = parseBackendHttpEnv(process.env);
const observability = initializeObservability({
  serviceName: "http-backend",
});
registerProcessErrorCapture();
analyticsService.initialize();

const server = Fastify({
  loggerInstance: observability.logger as FastifyBaseLogger,
  routerOptions: httpRouterOptions,
});

server.addHook("onSend", async (request, reply) => {
  reply.header("x-remora-request-id", request.id);

  for (const [key, value] of Object.entries(getActiveTraceResponseHeaders())) {
    reply.header(key, value);
  }
});

server.setErrorHandler((error, request, reply) => {
  captureObservabilityException(error, {
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url,
  });

  reply.send(error);
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

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

try {
  await server.listen({
    host: "0.0.0.0",
    port: env.API_PORT,
  });
} catch (error) {
  server.log.error({ error }, "Backend HTTP server failed to start");
  await shutdownObservability();

  throw error;
}

async function shutdown(signal: NodeJS.Signals) {
  try {
    server.log.info({ signal }, "Backend HTTP server shutting down");
    await server.close();
    await shutdownObservability();
  } catch (error) {
    server.log.error({ error, signal }, "Backend HTTP server shutdown failed");
    process.exitCode = 1;
  }
}
