import { Outlet } from "@tanstack/react-router";

export function WebSettingsRoute() {
  return (
    <main
      aria-label="Settings workspace"
      className="bg-background text-foreground min-h-svh"
    >
      <Outlet />
    </main>
  );
}
