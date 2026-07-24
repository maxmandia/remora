import { describe, expect, it, vi } from "vitest";

import { redirectAppToSignIn } from "./app-redirect";

describe("app authentication redirects", () => {
  it("preserves the current app URL when redirecting to sign in", () => {
    const replace = vi.fn();

    redirectAppToSignIn(
      {
        pathname: "/app/threads/thread_1",
        search: "?projectId=project_1",
        hash: "#result",
      },
      replace,
    );

    expect(replace).toHaveBeenCalledWith(
      "/sign-in?redirect=%2Fapp%2Fthreads%2Fthread_1%3FprojectId%3Dproject_1%23result",
    );
  });
});
