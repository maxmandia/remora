import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

import { getSessionFromHeaders } from "../modules/auth/auth.ts";

export const createTRPCContext = async ({
  req,
}: CreateFastifyContextOptions) => {
  const session = await getSessionFromHeaders(req.headers);

  return {
    session: session?.session ?? null,
    user: session?.user ?? null,
  };
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
