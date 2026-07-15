import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { initTRPC } from "@trpc/server";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { httpRouterOptions } from "./http.utils.ts";

const t = initTRPC.create();
const procedure = t.procedure.query(() => null);
const testRouter = t.router({
  credits: t.router({ getBalance: procedure }),
  generationThread: t.router({ listWithoutProject: procedure }),
  project: t.router({ listProjects: procedure }),
  modelRates: t.router({ estimateGenerationCost: procedure }),
});

describe("HTTP router options", () => {
  it("accepts tRPC batch paths longer than Fastify's default limit", async () => {
    const server = Fastify({ routerOptions: httpRouterOptions });

    await server.register(fastifyTRPCPlugin, {
      prefix: "/trpc",
      trpcOptions: { router: testRouter },
    });

    const paths = [
      "credits.getBalance",
      "generationThread.listWithoutProject",
      "project.listProjects",
      "modelRates.estimateGenerationCost",
    ];
    const response = await server.inject({
      method: "GET",
      url: `/trpc/${paths.join(",")}?batch=1&input=${encodeURIComponent("{}")}`,
    });

    expect(paths.join(",").length).toBeGreaterThan(100);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(paths.length);

    await server.close();
  });
});
