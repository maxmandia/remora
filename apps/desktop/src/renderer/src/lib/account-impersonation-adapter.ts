import type { AccountImpersonationAdapter } from "@remora/app/admin";

import { authBridge } from "./auth-bridge.ts";
import { suppressRendererAnalytics } from "./analytics.ts";

export const accountImpersonationAdapter: AccountImpersonationAdapter = {
  listUsers: (input) => authBridge.listUsers(input),
  async impersonateUser(userId) {
    await authBridge.impersonateUser(userId);
    suppressRendererAnalytics();
  },
};
