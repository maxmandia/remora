import { initializePreloadObservability } from "./preload/observability.ts";
import { setupPreloadBridge } from "./preload/index.ts";

initializePreloadObservability();
setupPreloadBridge();
