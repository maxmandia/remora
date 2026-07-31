import { createAppPreferencesStore } from "@remora/app/preferences";

export const desktopPreferencesStorageKey = "remora:desktop-preferences";

export const useDesktopPreferencesStore = createAppPreferencesStore({
  storageKey: desktopPreferencesStorageKey,
});
