import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "../providers/auth-provider.tsx";
import { BlankRouteSurface } from "./blank-route-surface.tsx";

export function AppRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  return <BlankRouteSurface status={status} user={user} />;
}
