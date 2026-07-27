/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

const storage = (() => {
  const items = new Map<string, string>();

  return {
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
})();

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage,
});

import {
  createSidebarPreferencesStore,
  sidebarPreferencesStorageVersion,
} from "./sidebar-preferences-store.ts";

describe("createSidebarPreferencesStore", () => {
  afterEach(() => {
    storage.clear();
  });

  it("defaults to expanded and persists only the sidebar preference", () => {
    const usePreferencesStore = createSidebarPreferencesStore({
      storageKey: "test:sidebar-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(true);

    usePreferencesStore.getState().setSidebarOpen(false);

    expect(
      JSON.parse(storage.getItem("test:sidebar-preferences") ?? ""),
    ).toEqual({
      state: { sidebarOpen: false },
      version: sidebarPreferencesStorageVersion,
    });
  });

  it("hydrates a new store from the versioned browser preference", () => {
    storage.setItem(
      "test:sidebar-preferences",
      JSON.stringify({
        state: { sidebarOpen: false },
        version: sidebarPreferencesStorageVersion,
      }),
    );

    const usePreferencesStore = createSidebarPreferencesStore({
      storageKey: "test:sidebar-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(false);
  });

  it("falls back to expanded when persisted JSON is malformed", () => {
    storage.setItem("test:sidebar-preferences", "{not-json");

    const usePreferencesStore = createSidebarPreferencesStore({
      storageKey: "test:sidebar-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(true);
  });

  it("keeps an in-memory preference when browser storage is unavailable", () => {
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "localStorage",
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage is blocked.");
      },
    });

    try {
      const usePreferencesStore = createSidebarPreferencesStore({
        storageKey: "test:unavailable-sidebar-preferences",
      });

      expect(usePreferencesStore.getState().sidebarOpen).toBe(true);

      usePreferencesStore.getState().setSidebarOpen(false);

      expect(usePreferencesStore.getState().sidebarOpen).toBe(false);
      expect(consoleWarn).toHaveBeenCalledTimes(1);
    } finally {
      if (localStorageDescriptor) {
        Object.defineProperty(window, "localStorage", localStorageDescriptor);
      }

      consoleWarn.mockRestore();
    }
  });
});
