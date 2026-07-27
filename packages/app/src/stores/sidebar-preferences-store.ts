import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

const sidebarPreferencesStorageVersion = 1;

type SidebarPreferencesState = {
  sidebarOpen: boolean;
  setSidebarOpen: (sidebarOpen: boolean) => void;
};

type CreateSidebarPreferencesStoreOptions = {
  storageKey: string;
};

function getBrowserStorage(): StateStorage {
  const storage =
    globalThis.document?.defaultView?.localStorage ??
    globalThis.window?.localStorage ??
    globalThis.localStorage;

  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    throw new Error("Browser localStorage is unavailable.");
  }

  return storage;
}

function createSidebarPreferencesStore({
  storageKey,
}: CreateSidebarPreferencesStoreOptions) {
  return create<SidebarPreferencesState>()(
    persist(
      (set) => ({
        sidebarOpen: true,
        setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      }),
      {
        name: storageKey,
        version: sidebarPreferencesStorageVersion,
        storage: createJSONStorage(getBrowserStorage),
        partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
      },
    ),
  );
}

export { createSidebarPreferencesStore, sidebarPreferencesStorageVersion };
export type { CreateSidebarPreferencesStoreOptions, SidebarPreferencesState };
