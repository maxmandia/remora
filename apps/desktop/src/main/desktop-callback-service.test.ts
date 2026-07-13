import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopCallbackService } from "./desktop-callback-service.ts";

const services: DesktopCallbackService[] = [];

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.stop()));
});

describe("DesktopCallbackService", () => {
  it("binds an ephemeral loopback port and dispatches one-time auth callbacks", async () => {
    const handle = vi.fn();
    const service = createService(["auth_nonce"]);
    const callbackUrl = await service.createAuthCallback(handle);
    callbackUrl.searchParams.set("token", "authorization-token");

    expect(callbackUrl.hostname).toBe("127.0.0.1");
    expect(Number(callbackUrl.port)).toBeGreaterThan(0);

    const response = await fetch(callbackUrl);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      "This local callback page is only used during development.",
    );
    expect(handle).toHaveBeenCalledWith(callbackUrl);
    expect((await fetch(callbackUrl)).status).toBe(404);
  });

  it("rejects unsupported methods and paths without consuming callbacks", async () => {
    const handle = vi.fn();
    const service = createService(["auth_nonce"]);
    const callbackUrl = await service.createAuthCallback(handle);

    expect((await fetch(callbackUrl, { method: "POST" })).status).toBe(405);
    expect(
      (await fetch(new URL("/callbacks/unknown/auth_nonce", callbackUrl)))
        .status,
    ).toBe(404);
    expect((await fetch(callbackUrl)).status).toBe(200);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it("expires callbacks and replaces stale auth attempts", async () => {
    let now = 1_000;
    const firstHandle = vi.fn();
    const secondHandle = vi.fn();
    const handleExpired = vi.fn();
    const service = createService(["first_nonce", "second_nonce"], () => now);
    const firstUrl = await service.createAuthCallback(firstHandle);
    const secondUrl = await service.createAuthCallback(
      secondHandle,
      handleExpired,
    );

    expect((await fetch(firstUrl)).status).toBe(404);

    now += 5 * 60 * 1000;
    expect((await fetch(secondUrl)).status).toBe(410);
    expect(firstHandle).not.toHaveBeenCalled();
    expect(secondHandle).not.toHaveBeenCalled();
    expect(handleExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps concurrent checkout callbacks independent", async () => {
    const firstHandle = vi.fn();
    const secondHandle = vi.fn();
    const service = createService(["first_nonce", "second_nonce"]);
    const firstUrl = await service.createCheckoutCallback(firstHandle);
    const secondUrl = await service.createCheckoutCallback(secondHandle);

    expect((await fetch(secondUrl)).status).toBe(200);
    expect((await fetch(firstUrl)).status).toBe(200);
    expect(firstHandle).toHaveBeenCalledTimes(1);
    expect(secondHandle).toHaveBeenCalledTimes(1);
  });

  it("uses independent ports for concurrent desktop instances", async () => {
    const firstService = createService(["first_nonce"]);
    const secondService = createService(["second_nonce"]);

    const [firstUrl, secondUrl] = await Promise.all([
      firstService.createAuthCallback(vi.fn()),
      secondService.createAuthCallback(vi.fn()),
    ]);

    expect(firstUrl.port).not.toBe(secondUrl.port);
  });

  it("clears callbacks and closes the listener when stopped", async () => {
    const service = createService(["auth_nonce"]);
    const callbackUrl = await service.createAuthCallback(vi.fn());

    await service.stop();

    await expect(fetch(callbackUrl)).rejects.toThrow();
  });
});

function createService(nonces: string[], now?: () => number) {
  const service = new DesktopCallbackService({
    createNonce: () => {
      const nonce = nonces.shift();

      if (!nonce) {
        throw new Error("Test nonce was not configured");
      }

      return nonce;
    },
    ...(now ? { now } : {}),
  });
  services.push(service);
  return service;
}
