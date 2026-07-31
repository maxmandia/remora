import { createAppPreferencesStore } from "@remora/app/preferences";

export const webPreferencesStorageKey = "remora:web-preferences";

export const useWebPreferencesStore = createAppPreferencesStore({
  storageKey: webPreferencesStorageKey,
});
