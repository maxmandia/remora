import { HotkeysProvider } from "@remora/app/hotkeys";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <HotkeysProvider>{children}</HotkeysProvider>;
}
