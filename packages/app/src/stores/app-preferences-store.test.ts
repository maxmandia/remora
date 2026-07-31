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
  createAppPreferencesStore,
  appPreferencesStorageVersion,
} from "./app-preferences-store.ts";

describe("createAppPreferencesStore", () => {
  afterEach(() => {
    storage.clear();
  });

  it("defaults to expanded and persists only the declared preferences", () => {
    const usePreferencesStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(true);
    expect(usePreferencesStore.getState().hasSeenWizardEntrance).toBe(false);

    usePreferencesStore.getState().setSidebarOpen(false);

    expect(
      JSON.parse(storage.getItem("test:app-preferences") ?? ""),
    ).toEqual({
      state: { hasSeenWizardEntrance: false, sidebarOpen: false },
      version: appPreferencesStorageVersion,
    });
  });

  it("marks the wizard entrance as seen and persists it across stores", () => {
    const usePreferencesStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
    });

    usePreferencesStore.getState().markWizardEntranceSeen();

    expect(usePreferencesStore.getState().hasSeenWizardEntrance).toBe(true);

    const useRecreatedStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
    });

    expect(useRecreatedStore.getState().hasSeenWizardEntrance).toBe(true);
  });

  it("migrates version 1 payloads by backfilling the wizard entrance flag", () => {
    storage.setItem(
      "test:app-preferences",
      JSON.stringify({
        state: { sidebarOpen: false },
        version: 1,
      }),
    );

    const usePreferencesStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(false);
    expect(usePreferencesStore.getState().hasSeenWizardEntrance).toBe(false);
  });

  it("hydrates a new store from the versioned browser preference", () => {
    storage.setItem(
      "test:app-preferences",
      JSON.stringify({
        state: { sidebarOpen: false },
        version: appPreferencesStorageVersion,
      }),
    );

    const usePreferencesStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
    });

    expect(usePreferencesStore.getState().sidebarOpen).toBe(false);
  });

  it("falls back to expanded when persisted JSON is malformed", () => {
    storage.setItem("test:app-preferences", "{not-json");

    const usePreferencesStore = createAppPreferencesStore({
      storageKey: "test:app-preferences",
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
      const usePreferencesStore = createAppPreferencesStore({
        storageKey: "test:unavailable-app-preferences",
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
