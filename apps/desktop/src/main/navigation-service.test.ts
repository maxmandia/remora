import { beforeEach, describe, expect, it, vi } from "vitest";

import { navigationChannel } from "../shared/navigation.ts";

const electronMocks = vi.hoisted(() => ({
  app: {
    isPackaged: false,
    whenReady: vi.fn(async () => undefined),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("electron", () => electronMocks);
vi.mock("./observability.ts", () => ({
  wrapIpcHandler: (_channel: string, handle: (...args: never[]) => unknown) =>
    handle,
}));

import { setupNavigationService } from "./navigation-service.ts";

describe("setupNavigationService", () => {
  beforeEach(() => {
    electronMocks.app.isPackaged = false;
    electronMocks.ipcMain.handle.mockReset();
  });

  it("creates local checkout callbacks and navigates after valid returns", async () => {
    let callbackHandler: ((url: URL) => void) | undefined;
    const callbackService = {
      createCheckoutCallback: vi.fn(async (handle: (url: URL) => void) => {
        callbackHandler = handle;
        return new URL(
          "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
        );
      }),
    };
    const window = createWindow();

    setupNavigationService(() => window as never, callbackService as never);
    const handle = getIpcHandler();

    await expect(handle()).resolves.toBe(
      "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
    );

    callbackHandler?.(
      new URL(
        "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678?credit_checkout=success",
      ),
    );

    expect(window.focus).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith(
      `${navigationChannel}:navigate`,
      { to: "/app/settings/credits" },
    );
  });

  it("returns null for packaged apps", async () => {
    electronMocks.app.isPackaged = true;
    const callbackService = { createCheckoutCallback: vi.fn() };

    setupNavigationService(() => null, callbackService as never);

    await expect(getIpcHandler()()).resolves.toBeNull();
    expect(callbackService.createCheckoutCallback).not.toHaveBeenCalled();
  });

  it("rejects checkout callbacks without a valid status", async () => {
    let callbackHandler: ((url: URL) => void) | undefined;
    const callbackService = {
      createCheckoutCallback: vi.fn(async (handle: (url: URL) => void) => {
        callbackHandler = handle;
        return new URL(
          "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
        );
      }),
    };

    setupNavigationService(
      () => createWindow() as never,
      callbackService as never,
    );
    await getIpcHandler()();

    expect(() =>
      callbackHandler?.(
        new URL(
          "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
        ),
      ),
    ).toThrow("Desktop checkout callback status was invalid");
  });
});

function getIpcHandler() {
  const handle = electronMocks.ipcMain.handle.mock.calls.find(
    ([channel]) =>
      channel === `${navigationChannel}:create-checkout-return-url`,
  )?.[1];

  if (!handle) {
    throw new Error("Checkout return URL handler was not registered");
  }

  return handle as () => Promise<string | null>;
}

function createWindow() {
  return {
    focus: vi.fn(),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    webContents: {
      isLoading: vi.fn(() => false),
      once: vi.fn(),
      send: vi.fn(),
    },
  };
}
