/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bootstrapMounts: vi.fn(),
  bootstrapProps: vi.fn(),
  params: {
    current: {} as { threadId?: string },
  },
  search: {
    current: {} as { projectId?: string },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  useParams: () => mocks.params.current,
  useSearch: () => mocks.search.current,
}));

vi.mock("./app-bootstrap", () => ({
  AppBootstrap: (props: {
    projectId: string | null;
    threadId: string | null;
  }) => {
    mocks.bootstrapProps(props);

    useEffect(() => {
      mocks.bootstrapMounts();
    }, []);

    return null;
  },
}));

vi.mock("../providers/app-providers", () => ({
  AppProviders: ({ children }: { children: ReactNode }) => children,
}));

import { WebAppRoute } from "./web-app-route";

describe("web app route", () => {
  beforeEach(() => {
    mocks.bootstrapMounts.mockReset();
    mocks.bootstrapProps.mockReset();
    mocks.params.current = {};
    mocks.search.current = {};
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps one bootstrap mounted while route inputs change", () => {
    mocks.search.current = { projectId: "project_1" };
    const rendered = render(<WebAppRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      projectId: "project_1",
      threadId: null,
    });

    mocks.params.current = { threadId: "thread_1" };
    mocks.search.current = {};
    rendered.rerender(<WebAppRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      projectId: null,
      threadId: "thread_1",
    });
    expect(mocks.bootstrapMounts).toHaveBeenCalledTimes(1);
  });
});
