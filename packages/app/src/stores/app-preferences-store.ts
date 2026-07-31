import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

const appPreferencesStorageVersion = 2;

type AppPreferencesState = {
  hasSeenWizardEntrance: boolean;
  markWizardEntranceSeen: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (sidebarOpen: boolean) => void;
};

type CreateAppPreferencesStoreOptions = {
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

function createAppPreferencesStore({
  storageKey,
}: CreateAppPreferencesStoreOptions) {
  return create<AppPreferencesState>()(
    persist(
      (set) => ({
        hasSeenWizardEntrance: false,
        markWizardEntranceSeen: () => set({ hasSeenWizardEntrance: true }),
        sidebarOpen: true,
        setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      }),
      {
        name: storageKey,
        version: appPreferencesStorageVersion,
        storage: createJSONStorage(getBrowserStorage),
        partialize: (state) => ({
          hasSeenWizardEntrance: state.hasSeenWizardEntrance,
          sidebarOpen: state.sidebarOpen,
        }),
        // Version 1 payloads only lack the wizard entrance flag, which the
        // hydration merge backfills from the defaults above.
        migrate: (persistedState) =>
          persistedState as Partial<AppPreferencesState>,
      },
    ),
  );
}

export { createAppPreferencesStore, appPreferencesStorageVersion };
export type { CreateAppPreferencesStoreOptions, AppPreferencesState };
