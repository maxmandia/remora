/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    current: {
      requestAuth: vi.fn(),
      status: "loading" as "loading" | "signed-in" | "signed-out",
      user: null as { id: string } | null,
    },
  },
  workspaceBootstrap: vi.fn(),
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.auth.current,
}));

vi.mock("./web-generation-workspace-bootstrap", async () => {
  const React = await import("react");

  return {
    FullPageWorkspaceStatus: ({ children }: { children: ReactNode }) =>
      React.createElement("main", null, children),
    WebGenerationWorkspaceBootstrap: (props: unknown) => {
      mocks.workspaceBootstrap(props);
      return React.createElement("div", null, "Workspace bootstrap");
    },
  };
});

import { AppBootstrap } from "./app-bootstrap";

describe("app bootstrap", () => {
  beforeEach(() => {
    mocks.auth.current.requestAuth.mockReset();
    mocks.auth.current.requestAuth.mockResolvedValue(undefined);
    mocks.auth.current.status = "loading";
    mocks.auth.current.user = null;
    mocks.workspaceBootstrap.mockReset();
  });

  afterEach(cleanup);

  it("shows session loading before delegating to the workspace bootstrap", () => {
    render(<AppBootstrap />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(mocks.workspaceBootstrap).not.toHaveBeenCalled();
  });

  it("delegates authenticated route state to the workspace bootstrap", () => {
    mocks.auth.current.status = "signed-in";
    mocks.auth.current.user = { id: "user_1" };

    render(
      <AppBootstrap
        initialPrompt="A keyed Explore prompt"
        projectId="project_1"
        threadId="thread_1"
      />,
    );

    expect(mocks.workspaceBootstrap).toHaveBeenCalledWith({
      initialGenerationPreset: null,
      initialPrompt: "A keyed Explore prompt",
      isSignedIn: true,
      projectId: "project_1",
      requestAuth: mocks.auth.current.requestAuth,
      threadId: "thread_1",
      userId: "user_1",
    });
  });

  it("delegates signed-out sessions without authenticated state", () => {
    mocks.auth.current.status = "signed-out";

    render(<AppBootstrap />);

    expect(mocks.workspaceBootstrap).toHaveBeenCalledWith({
      initialGenerationPreset: null,
      initialPrompt: "",
      isSignedIn: false,
      projectId: null,
      requestAuth: mocks.auth.current.requestAuth,
      threadId: null,
      userId: null,
    });
  });
});
