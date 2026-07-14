declare module "mixpanel-browser/src/loaders/loader-module-core" {
  import type { OverridedMixpanel } from "mixpanel-browser";

  const mixpanel: OverridedMixpanel;
  export default mixpanel;
}
