import { createSidebarPreferencesStore } from "@remora/app/sidebar";

export const desktopPreferencesStorageKey = "remora:desktop-preferences";

export const useDesktopPreferencesStore = createSidebarPreferencesStore({
  storageKey: desktopPreferencesStorageKey,
});
