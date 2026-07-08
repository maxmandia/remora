import { afterEach, describe, expect, it, vi } from "vitest";

import { desktopUpdateChannel } from "../shared/desktop-update.ts";

const electronMocks = vi.hoisted(() => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock("electron", () => electronMocks);

describe("preload bridge", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("exposes the desktop update bridge", async () => {
    const { setupPreloadBridge } = await import("./index.ts");

    setupPreloadBridge();

    const bridge = getExposedBridge("remoraDesktopUpdate");

    await bridge.getState();
    await bridge.installReadyUpdate();

    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      `${desktopUpdateChannel}:get-state`,
    );
    expect(electronMocks.ipcRenderer.invoke).toHaveBeenCalledWith(
      `${desktopUpdateChannel}:install-ready-update`,
    );
  });

  it("validates desktop update state change events", async () => {
    const { setupPreloadBridge } = await import("./index.ts");
    const callback = vi.fn();

    setupPreloadBridge();

    const bridge = getExposedBridge("remoraDesktopUpdate");
    const unsubscribe = bridge.onStateChange(callback);
    const listener = electronMocks.ipcRenderer.on.mock.calls.find(
      ([channel]) => channel === `${desktopUpdateChannel}:state-change`,
    )?.[1] as ((...args: unknown[]) => void) | undefined;

    expect(listener).toBeTypeOf("function");

    listener?.({}, { status: "ready", version: "0.2.3" });
    listener?.({}, { status: "ready" });
    unsubscribe();

    expect(callback).toHaveBeenCalledWith({
      status: "ready",
      version: "0.2.3",
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(electronMocks.ipcRenderer.off).toHaveBeenCalledWith(
      `${desktopUpdateChannel}:state-change`,
      listener,
    );
  });
});

function getExposedBridge(name: "remoraDesktopUpdate") {
  const bridge = electronMocks.contextBridge.exposeInMainWorld.mock.calls.find(
    ([bridgeName]) => bridgeName === name,
  )?.[1];

  if (!bridge) {
    throw new Error(`${name} bridge was not exposed`);
  }

  return bridge as {
    getState: () => Promise<unknown>;
    installReadyUpdate: () => Promise<unknown>;
    onStateChange: (callback: (state: unknown) => void) => () => void;
  };
}
