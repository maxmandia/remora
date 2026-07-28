import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function AdminRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({
      to: "/app/admin/impersonation",
      replace: true,
    });
  }, [navigate]);

  return null;
}
