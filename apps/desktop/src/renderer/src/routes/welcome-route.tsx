import { Button } from "@remora/ui";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import {
  getHotkeyDefinition,
  getHotkeyDisplayParts,
} from "../lib/hotkey-registry.ts";
import { useAuth } from "../providers/auth-provider.tsx";
import { useHotkey } from "../providers/hotkeys-provider.tsx";
import { BlankRouteSurface } from "./blank-route-surface.tsx";

const requestSignInHotkey = getHotkeyDefinition("auth.requestSignIn");
const requestSignInHotkeyDisplayParts = getHotkeyDisplayParts(
  requestSignInHotkey.combo,
);

export function WelcomeRoute() {
  const { error, requestAuth, status, user } = useAuth();
  const navigate = useNavigate();
  const handleRequestAuth = useCallback(() => {
    void requestAuth();
  }, [requestAuth]);

  useHotkey("auth.requestSignIn", {
    enabled: status === "signed-out",
    onKeyDown: handleRequestAuth,
  });

  useEffect(() => {
    if (status === "signed-in") {
      void navigate({ to: "/app", replace: true });
    }
  }, [navigate, status]);

  if (status !== "signed-out") {
    return <BlankRouteSurface status={status} user={user} />;
  }

  return (
    <main
      className="flex h-full min-h-full items-center justify-center bg-background px-6 py-8 text-foreground"
      data-auth-status={status}
      data-user-id={user?.id}
    >
      <section className="flex flex-col items-center text-center">
        <img
          src="/remora.png"
          alt="Remora Icon"
          draggable={false}
          className="w-16 h-16 select-none"
        />
        <img
          src="/logo.svg"
          alt="Remora Logo"
          draggable={false}
          className="w-34 h-auto select-none pb-3"
        />
        <p className="font-light text-muted-foreground w-2/3 mt-1 text-md select-none">
          An opinionated tool purpose built for generative media.
        </p>
        <Button
          aria-keyshortcuts={requestSignInHotkey.combo}
          className="mt-4"
          size="lg"
          shortcut={requestSignInHotkeyDisplayParts}
          variant="shortcut"
          onClick={handleRequestAuth}
        >
          Get started
        </Button>
        {error ? (
          <p className="max-w-xs text-xs text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
