/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
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

import { WebGenerationRoute } from "./web-generation-route";

describe("web generation route", () => {
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
    const rendered = render(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      projectId: "project_1",
      threadId: null,
    });

    mocks.params.current = { threadId: "thread_1" };
    mocks.search.current = {};
    rendered.rerender(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      projectId: null,
      threadId: "thread_1",
    });
    expect(mocks.bootstrapMounts).toHaveBeenCalledTimes(1);
  });
});
