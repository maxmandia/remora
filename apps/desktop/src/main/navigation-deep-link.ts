import type { DesktopNavigationTarget } from "../shared/navigation.ts";
import { getCustomProtocolPath } from "./auth-deep-link.ts";

type ElectronNavigationDeepLinkOptions = {
  protocolScheme: string;
};

const desktopNavigationRoutes = new Set<DesktopNavigationTarget["to"]>([
  "/app/settings/credits",
]);

export function getDesktopNavigationTargetFromDeepLink(
  url: string,
  { protocolScheme }: ElectronNavigationDeepLinkOptions,
): DesktopNavigationTarget | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== `${protocolScheme}:`) {
      return null;
    }

    const path = getCustomProtocolPath(parsed);

    if (desktopNavigationRoutes.has(path as DesktopNavigationTarget["to"])) {
      return {
        to: path as DesktopNavigationTarget["to"],
      };
    }

    return null;
  } catch {
    return null;
  }
}
