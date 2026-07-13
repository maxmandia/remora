export const navigationChannel = "remora-navigation";

export type DesktopNavigationTarget = {
  to: "/app/settings/credits";
};

export type DesktopNavigationBridge = {
  createCheckoutReturnUrl: () => Promise<string | null>;
  onNavigate: (
    callback: (target: DesktopNavigationTarget) => unknown,
  ) => () => void;
};

export function isDesktopNavigationTarget(
  value: unknown,
): value is DesktopNavigationTarget {
  return (
    typeof value === "object" &&
    value !== null &&
    "to" in value &&
    value.to === "/app/settings/credits"
  );
}
