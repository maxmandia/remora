import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerRealtimeRoutes } from "./realtime.router.ts";

import type { FastifyInstance } from "fastify";
import type { RealtimeService } from "./realtime.service.ts";

const mocks = vi.hoisted(() => ({
  getSessionFromHeaders: vi.fn(),
}));

vi.mock("../auth/auth.ts", () => ({
  getSessionFromHeaders: mocks.getSessionFromHeaders,
}));

describe("registerRealtimeRoutes", () => {
  let server: FastifyInstance;
  let service: RealtimeService;
  let unregister: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    unregister = vi.fn();
    service = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => undefined),
      registerConnection: vi.fn(() => unregister),
    } as unknown as RealtimeService;
    server = Fastify();

    await server.register(websocket);
    await registerRealtimeRoutes(server, {
      allowedOrigins: ["http://localhost:3001"],
      service,
    });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.clearAllMocks();
  });

  it("rejects disallowed websocket origins before authenticating", async () => {
    mocks.getSessionFromHeaders.mockResolvedValue({
      user: { id: "user_1" },
    });

    await expect(
      server.injectWS("/api/realtime", {
        headers: {
          origin: "https://evil.example",
        },
      }),
    ).rejects.toThrow();

    expect(mocks.getSessionFromHeaders).not.toHaveBeenCalled();
    expect(service.registerConnection).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated websocket connections", async () => {
    mocks.getSessionFromHeaders.mockResolvedValue(null);

    await expect(
      server.injectWS("/api/realtime", {
        headers: {
          origin: "http://localhost:3001",
        },
      }),
    ).rejects.toThrow();

    expect(service.registerConnection).not.toHaveBeenCalled();
  });

  it("registers authenticated sockets for the session user", async () => {
    mocks.getSessionFromHeaders.mockResolvedValue({
      user: { id: "user_1" },
    });

    const socket = await server.injectWS("/api/realtime", {
      headers: {
        origin: "http://localhost:3001",
      },
    });

    expect(service.start).toHaveBeenCalledTimes(1);
    expect(service.registerConnection).toHaveBeenCalledWith({
      userId: "user_1",
      socket: expect.anything(),
    });

    socket.terminate();
  });
});
