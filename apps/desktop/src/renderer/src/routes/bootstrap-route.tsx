import { useAuth } from "@remora/app/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { BlankRouteSurface } from "./blank-route-surface.tsx";

export function BootstrapRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "signed-in") {
      void navigate({ to: "/app", replace: true });
      return;
    }

    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  return <BlankRouteSurface status={status} user={user} />;
}
