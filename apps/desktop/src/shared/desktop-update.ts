export const desktopUpdateChannel = "remora-desktop-update";

export type DesktopUpdateState =
  | { status: "disabled" | "idle" | "checking" | "downloading" }
  | { status: "ready"; version: string | null };

export type DesktopUpdateBridge = {
  getState: () => Promise<DesktopUpdateState>;
  installReadyUpdate: () => Promise<boolean>;
  onStateChange: (
    callback: (state: DesktopUpdateState) => unknown,
  ) => () => void;
};

const desktopUpdateStatuses = new Set([
  "disabled",
  "idle",
  "checking",
  "downloading",
  "ready",
]);

export function isDesktopUpdateState(
  value: unknown,
): value is DesktopUpdateState {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }

  const status = value.status;

  if (typeof status !== "string" || !desktopUpdateStatuses.has(status)) {
    return false;
  }

  if (status !== "ready") {
    return true;
  }

  return (
    "version" in value &&
    (typeof value.version === "string" || value.version === null)
  );
}
