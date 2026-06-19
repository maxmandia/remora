/**
 * @vitest-environment jsdom
 */

import { TRPCClientError } from "@trpc/client";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppQueryClient } from "./use-app-query-client.ts";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("@remora/ui", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

describe("useAppQueryClient", () => {
  afterEach(() => {
    cleanup();
    mocks.toastError.mockReset();
  });

  it("shows a toast for tRPC query errors", async () => {
    const queryClient = renderAppQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["broken-query"],
        queryFn: async () => {
          throw new TRPCClientError("Model list failed");
        },
        retry: false,
      }),
    ).rejects.toThrow("Model list failed");

    expect(mocks.toastError).toHaveBeenCalledWith("Model list failed");
  });

  it("shows a toast for tRPC mutation errors", async () => {
    const queryClient = renderAppQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["broken-mutation"],
      mutationFn: async () => {
        throw new TRPCClientError("Create generation failed");
      },
      retry: false,
    });

    await expect(mutation.execute(undefined)).rejects.toThrow(
      "Create generation failed",
    );

    expect(mocks.toastError).toHaveBeenCalledWith("Create generation failed");
  });

  it("does not show a toast for suppressed tRPC mutation errors", async () => {
    const queryClient = renderAppQueryClient();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: ["inline-handled-mutation"],
      mutationFn: async () => {
        throw new TRPCClientError("Project already exists");
      },
      meta: {
        suppressErrorToast: true,
      },
      retry: false,
    });

    await expect(mutation.execute(undefined)).rejects.toThrow(
      "Project already exists",
    );

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});

function renderAppQueryClient() {
  const { result } = renderHook(() => useAppQueryClient());

  return result.current;
}
