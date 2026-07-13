import { afterEach, describe, expect, it, vi } from "vitest";

import { authChannel } from "../shared/auth.ts";

const electronMocks = vi.hoisted(() => ({
  app: {
    getPath: vi.fn(() => "/tmp/remora-test"),
    isPackaged: false,
    on: vi.fn(),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: vi.fn(() => new Promise<void>(() => undefined)),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  safeStorage: {
    decryptString: vi.fn(),
    encryptString: vi.fn(),
    isEncryptionAvailable: vi.fn(() => false),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

vi.mock("electron", () => electronMocks);
vi.mock("./observability.ts", () => ({
  setDesktopObservabilityUser: vi.fn(),
  wrapIpcHandler: (_channel: string, handle: (...args: never[]) => unknown) =>
    handle,
}));

describe("desktop auth service callbacks", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    electronMocks.app.isPackaged = false;
  });

  it("uses a loopback callback without registering Electron in development", async () => {
    const createAuthCallback = vi.fn(
      async () =>
        new URL(
          "http://127.0.0.1:49152/callbacks/auth/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
        ),
    );
    const { setupAuthService } = await import("./auth-service.ts");

    setupAuthService(() => null, { createAuthCallback } as never);
    await getRequestAuthHandler()();

    expect(electronMocks.app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
    expect(createAuthCallback).toHaveBeenCalledTimes(1);
    const openedUrl = new URL(
      electronMocks.shell.openExternal.mock.calls[0]?.[0] as string,
    );
    expect(openedUrl.searchParams.get("desktop_callback_port")).toBe("49152");
    expect(openedUrl.searchParams.get("desktop_callback_nonce")).toBe(
      "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
    );
  });

  it("registers the protocol and retains deep-link auth for packaged apps", async () => {
    electronMocks.app.isPackaged = true;
    const createAuthCallback = vi.fn();
    const { setupAuthService } = await import("./auth-service.ts");

    setupAuthService(() => null, { createAuthCallback } as never);
    await getRequestAuthHandler()();

    expect(electronMocks.app.setAsDefaultProtocolClient).toHaveBeenCalledWith(
      "app.remora.desktop",
    );
    expect(createAuthCallback).not.toHaveBeenCalled();
    const openedUrl = new URL(
      electronMocks.shell.openExternal.mock.calls[0]?.[0] as string,
    );
    expect(openedUrl.searchParams.has("desktop_callback_port")).toBe(false);
  });

  it("reports a retryable error when the local listener cannot start", async () => {
    const send = vi.fn();
    const createAuthCallback = vi.fn(async () => {
      throw new Error("Address unavailable");
    });
    const { setupAuthService } = await import("./auth-service.ts");

    setupAuthService(() => ({ webContents: { send } }) as never, {
      createAuthCallback,
    } as never);
    await getRequestAuthHandler()();

    expect(electronMocks.shell.openExternal).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith(`${authChannel}:error`, {
      message: "Unable to start the sign-in callback. Try signing in again.",
    });
  });
});

function getRequestAuthHandler() {
  const handle = electronMocks.ipcMain.handle.mock.calls.find(
    ([channel]) => channel === `${authChannel}:request-auth`,
  )?.[1];

  if (!handle) {
    throw new Error("Request auth handler was not registered");
  }

  return handle as () => Promise<void>;
}
