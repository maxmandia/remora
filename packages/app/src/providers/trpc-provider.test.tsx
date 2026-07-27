/** @vitest-environment jsdom */

import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AppRouter } from "@remora/backend/types";

import { TRPCProvider, useTRPC, useTRPCClient } from "./trpc-provider.ts";

describe("TRPCProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("provides the supplied client and typed query helpers", () => {
    const queryClient = new QueryClient();
    const trpcClient = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: "http://localhost/trpc",
        }),
      ],
    });

    render(
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <TRPCProbe expectedClient={trpcClient} />
      </TRPCProvider>,
    );

    const probe = screen.getByTestId("trpc");

    expect(probe.getAttribute("data-client-matches")).toBe("true");
    expect(probe.getAttribute("data-balance-query-key")).toBe(
      JSON.stringify([["credits", "getBalance"], { type: "query" }]),
    );
  });
});

function TRPCProbe({
  expectedClient,
}: {
  expectedClient: TRPCClient<AppRouter>;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();

  return (
    <output
      data-balance-query-key={JSON.stringify(
        trpc.credits.getBalance.queryKey(),
      )}
      data-client-matches={String(trpcClient === expectedClient)}
      data-testid="trpc"
    />
  );
}
