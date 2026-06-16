import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { TRPCClientErrorLike } from "@trpc/client";

import type { AppRouter } from "@remora/backend/types";

export type AppTRPCError = TRPCClientErrorLike<AppRouter>;

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();
