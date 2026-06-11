import type { FastifyInstance, FastifyRequest } from "fastify";

import { getSessionFromHeaders } from "../auth/auth.ts";
import { realtimeService } from "./realtime.service.ts";

import type { User } from "../auth/auth.ts";
import type { RealtimeService } from "./realtime.service.ts";

const realtimeRequestUsers = new WeakMap<FastifyRequest, User>();

export async function registerRealtimeRoutes(
  server: FastifyInstance,
  {
    allowedOrigins,
    service = realtimeService,
  }: {
    allowedOrigins: string[];
    service?: RealtimeService;
  },
) {
  await service.start();

  server.addHook("onClose", async () => {
    await service.stop();
  });

  server.get(
    "/api/realtime",
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const origin = request.headers.origin;

        if (
          typeof origin === "string" &&
          !allowedOrigins.includes(origin)
        ) {
          return reply.status(403).send({ error: "Origin is not allowed" });
        }

        const session = await getSessionFromHeaders(request.headers);

        if (!session?.user) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        realtimeRequestUsers.set(request, session.user);
      },
    },
    (socket, request) => {
      const user = realtimeRequestUsers.get(request);

      if (!user) {
        socket.close(1008, "Unauthorized");
        return;
      }

      const unregister = service.registerConnection({
        userId: user.id,
        socket,
      });

      socket.on("close", unregister);
      socket.on("error", unregister);
    },
  );
}
