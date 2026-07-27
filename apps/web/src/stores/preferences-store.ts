import { createSidebarPreferencesStore } from "@remora/app/sidebar";

export const webPreferencesStorageKey = "remora:web-preferences";

export const useWebPreferencesStore = createSidebarPreferencesStore({
  storageKey: webPreferencesStorageKey,
});
