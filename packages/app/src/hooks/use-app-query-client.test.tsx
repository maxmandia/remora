/**
 * @vitest-environment jsdom
 */

import { TRPCClientError } from "@trpc/client";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppQueryClient } from "./use-app-query-client.ts";

const mocks = vi.hoisted(() => ({
  toastMessage: vi.fn(),
}));

vi.mock("@remora/ui", () => ({
  toast: {
    message: mocks.toastMessage,
  },
}));

describe("useAppQueryClient", () => {
  afterEach(() => {
    cleanup();
    mocks.toastMessage.mockReset();
  });

  it("configures shared query defaults", () => {
    const { queryClient } = renderAppQueryClient();

    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      refetchOnWindowFocus: false,
      retry: 1,
    });
  });

  it("retains one query client for the mounted provider root", () => {
    const { queryClient, rerender, result } = renderAppQueryClient();

    rerender();

    expect(result.current).toBe(queryClient);
  });

  it("shows a toast for tRPC query errors", async () => {
    const { queryClient } = renderAppQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["broken-query"],
        queryFn: async () => {
          throw new TRPCClientError("Model list failed");
        },
        retry: false,
      }),
    ).rejects.toThrow("Model list failed");

    expect(mocks.toastMessage).toHaveBeenCalledWith("An error occurred", {
      description: "Model list failed",
    });
  });

  it("shows a toast for tRPC mutation errors", async () => {
    const { queryClient } = renderAppQueryClient();
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

    expect(mocks.toastMessage).toHaveBeenCalledWith("An error occurred", {
      description: "Create generation failed",
    });
  });

  it("does not show a toast for suppressed tRPC query errors", async () => {
    const { queryClient } = renderAppQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["inline-handled-query"],
        queryFn: async () => {
          throw new TRPCClientError("Estimate unavailable");
        },
        meta: {
          suppressErrorToast: true,
        },
        retry: false,
      }),
    ).rejects.toThrow("Estimate unavailable");

    expect(mocks.toastMessage).not.toHaveBeenCalled();
  });

  it("does not show a toast for suppressed tRPC mutation errors", async () => {
    const { queryClient } = renderAppQueryClient();
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

    expect(mocks.toastMessage).not.toHaveBeenCalled();
  });

  it("does not show a toast for non-tRPC errors", async () => {
    const { queryClient } = renderAppQueryClient();

    await expect(
      queryClient.fetchQuery({
        queryKey: ["local-error"],
        queryFn: async () => {
          throw new Error("Local query failed");
        },
        retry: false,
      }),
    ).rejects.toThrow("Local query failed");

    expect(mocks.toastMessage).not.toHaveBeenCalled();
  });
});

function renderAppQueryClient() {
  const rendered = renderHook(() => useAppQueryClient());

  return {
    ...rendered,
    queryClient: rendered.result.current,
  };
}
