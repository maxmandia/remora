/** @vitest-environment jsdom */
/** @vitest-environment-options {"url":"http://localhost/app/settings/credits"} */

import { HotkeysProvider } from "@remora/app/hotkeys";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: {
    current: "/app/settings/credits",
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    "aria-label"?: string;
    children: React.ReactNode;
    className?: string;
    search?: Record<string, unknown>;
    to: string;
  }) => (
    <a href={to} aria-label={props["aria-label"]} className={props.className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="settings-outlet" />,
  useLocation: () => ({ pathname: mocks.pathname.current }),
  useNavigate: () => mocks.navigate,
}));

import {
  useWebPreferencesStore,
  webPreferencesStorageKey,
} from "../stores/preferences-store";
import { WebSettingsRoute } from "./web-settings-route";

describe("web settings route", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.pathname.current = "/app/settings/credits";
    useWebPreferencesStore.setState({ sidebarOpen: true });
    localStorageMock.removeItem(webPreferencesStorageKey);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the shared settings sidebar in the browser workspace shell", () => {
    renderWebSettingsRoute();

    const workspace = screen.getByRole("main", {
      name: "Settings workspace",
    });
    const settingsSidebar = screen.getByRole("complementary", {
      name: "Settings",
    });
    const creditsLink = screen.getByRole("link", { name: "Credits" });

    expect(workspace).toBeTruthy();
    expect(settingsSidebar).toBeTruthy();
    expect(screen.getByText("General")).toBeTruthy();
    expect(creditsLink.getAttribute("href")).toBe("/app/settings/credits");
    expect(creditsLink.getAttribute("aria-current")).toBe("page");
    expect(creditsLink.getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("button", { name: "Hide sidebar" })).toBeTruthy();
    expect(screen.getByTestId("settings-outlet")).toBeTruthy();
  });

  it("uses host navigation for the credits destination", () => {
    renderWebSettingsRoute();

    fireEvent.click(screen.getByRole("link", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("persists settings-shell sidebar toggles", () => {
    renderWebSettingsRoute();

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));

    expect(useWebPreferencesStore.getState().sidebarOpen).toBe(false);
    expect(localStorageMock.getItem(webPreferencesStorageKey)).toContain(
      '"sidebarOpen":false',
    );
    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
  });

  it("does not expose admin navigation from settings", () => {
    renderWebSettingsRoute();

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});

function renderWebSettingsRoute() {
  return render(
    <HotkeysProvider>
      <WebSettingsRoute />
    </HotkeysProvider>,
  );
}
