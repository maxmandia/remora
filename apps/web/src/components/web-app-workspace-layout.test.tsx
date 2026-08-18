/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { HotkeysProvider } from "@remora/app/hotkeys";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localStorageMock = vi.hoisted(() => {
  const items = new Map<string, string>();
  const storage = {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  } satisfies Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

  if (globalThis.window) {
    Object.defineProperty(globalThis.window, "localStorage", {
      configurable: true,
      value: storage,
    });
  }

  return storage;
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    search?: Record<string, unknown>;
    to: string;
  }) => <a href={to} {...props} />,
}));

import { WebAppWorkspaceLayout } from "./web-app-workspace-layout";
import {
  useWebPreferencesStore,
  webPreferencesStorageKey,
} from "../stores/preferences-store";

describe("web app workspace layout", () => {
  beforeEach(() => {
    useWebPreferencesStore.setState({ sidebarOpen: true });
    localStorageMock.removeItem(webPreferencesStorageKey);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an expanded fixed-width browser shell with a compact sidebar control", () => {
    const { container } = renderWorkspace();

    const workspace = container.querySelector('[data-slot="sidebar-wrapper"]');
    const controls = container.querySelector(
      '[data-slot="web-app-sidebar-controls"]',
    );
    const logo = controls?.querySelector('[data-slot="web-app-sidebar-logo"]');

    expect(workspace?.getAttribute("data-state")).toBe("expanded");
    expect(
      (workspace as HTMLElement).style.getPropertyValue("--sidebar-width"),
    ).toBe("16rem");
    expect(
      (workspace as HTMLElement).style.getPropertyValue(
        "--workspace-sidebar-header-offset",
      ),
    ).toBe("44px");
    expect(workspace?.className).toContain(
      "grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
    );
    expect(workspace?.className).toContain(
      "data-[state=collapsed]:grid-cols-[0rem_minmax(0,1fr)]",
    );
    expect(workspace?.className).toContain(
      "transition-[grid-template-columns]",
    );
    expect(workspace?.className).toContain("duration-300");
    expect(workspace?.className).toContain("motion-reduce:transition-none");
    expect(controls?.className).toContain("h-11");
    expect(controls?.className).toContain("w-[var(--sidebar-width)]");
    expect(controls?.className).toContain("justify-between");
    expect(controls?.className).toContain("transition-[width]");
    expect(controls?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-14",
    );
    expect(controls?.className).toContain("z-30");
    expect(
      screen.getByRole("link", { name: "Remora home" }).getAttribute("href"),
    ).toBe("/app");
    expect(logo?.getAttribute("src")).toBe("/remora-wordmark.svg");
    expect(logo?.className).toContain("w-16");
    expect(logo?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-0",
    );
    expect(logo?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:opacity-0",
    );
    expect(
      Array.from(controls?.querySelectorAll("button") ?? [], (button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual(["Hide sidebar"]);
    expect(
      screen.getByRole("main", { name: "Generation workspace" }),
    ).toBeTruthy();
  });

  it("persists sidebar toggles and ignores the shortcut while typing", () => {
    const { container } = renderWorkspace();
    const workspace = container.querySelector('[data-slot="sidebar-wrapper"]');
    const controls = container.querySelector(
      '[data-slot="web-app-sidebar-controls"]',
    );
    const logo = controls?.querySelector('[data-slot="web-app-sidebar-logo"]');

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(workspace?.getAttribute("data-state")).toBe("collapsed");
    expect(controls?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-14",
    );
    expect(logo?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-0",
    );
    expect(getStoredWebPreferences()?.state.sidebarOpen).toBe(false);
    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();

    const prompt = document.createElement("textarea");
    document.body.append(prompt);
    fireEvent.keyDown(prompt, { key: "B", shiftKey: true });
    prompt.remove();

    expect(workspace?.getAttribute("data-state")).toBe("collapsed");
    expect(getStoredWebPreferences()?.state.sidebarOpen).toBe(false);

    fireEvent.keyDown(document, { key: "B", shiftKey: true });

    expect(workspace?.getAttribute("data-state")).toBe("expanded");
    expect(getStoredWebPreferences()?.state.sidebarOpen).toBe(true);
  });

  it("hydrates a stored collapsed preference", async () => {
    localStorageMock.setItem(
      webPreferencesStorageKey,
      JSON.stringify({
        state: { sidebarOpen: false },
        version: 1,
      }),
    );
    await useWebPreferencesStore.persist.rehydrate();

    const { container } = renderWorkspace();

    expect(
      container
        .querySelector('[data-slot="sidebar-wrapper"]')
        ?.getAttribute("data-state"),
    ).toBe("collapsed");
    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
    expect(
      container.querySelector('[data-slot="web-app-sidebar-controls"]'),
    ).toBeTruthy();
    expect(
      container.querySelectorAll(
        '[data-slot="web-app-sidebar-controls"] button',
      ),
    ).toHaveLength(1);
  });
});

function renderWorkspace() {
  return render(
    <HotkeysProvider>
      <WebAppWorkspaceLayout
        sidebar={<aside aria-label="Test sidebar">Sidebar</aside>}
      >
        <textarea aria-label="Prompt" />
        Workspace
      </WebAppWorkspaceLayout>
    </HotkeysProvider>,
  );
}

function getStoredWebPreferences() {
  const item = localStorageMock.getItem(webPreferencesStorageKey);

  return item
    ? (JSON.parse(item) as {
        state: { sidebarOpen?: boolean };
        version: number;
      })
    : null;
}
