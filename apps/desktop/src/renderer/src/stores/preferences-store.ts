import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

export const desktopPreferencesStorageKey = "remora:desktop-preferences";

type DesktopPreferencesState = {
  sidebarOpen: boolean;
  setSidebarOpen: (sidebarOpen: boolean) => void;
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

export const useDesktopPreferencesStore = create<DesktopPreferencesState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: desktopPreferencesStorageKey,
      version: 1,
      storage: createJSONStorage(getBrowserStorage),
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    },
  ),
);
