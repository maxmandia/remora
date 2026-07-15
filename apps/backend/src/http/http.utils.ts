import type { FastifyServerOptions } from "fastify";

export const httpRouterOptions = {
  maxParamLength: 5_000,
} satisfies FastifyServerOptions["routerOptions"];
