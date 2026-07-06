import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "./router.tsx";
import { initializeRendererObservability } from "./lib/observability.ts";
import "./styles.css";

initializeRendererObservability();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

window.remoraNavigation.onNavigate((target) => {
  void router.navigate({ to: target.to });
});

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
