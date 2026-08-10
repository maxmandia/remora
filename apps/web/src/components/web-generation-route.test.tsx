/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  exploreArtworks,
  exploreVhsTapes,
  type ExplorePromptKey,
  type ExploreVhsTapeDetails,
} from "@remora/app/explore";

const mocks = vi.hoisted(() => ({
  bootstrapMounts: vi.fn(),
  bootstrapProps: vi.fn(),
  params: {
    current: {} as { threadId?: string },
  },
  search: {
    current: {} as {
      exploreRef?: ExplorePromptKey;
      projectId?: string;
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => mocks.params.current,
  useSearch: () => mocks.search.current,
}));

vi.mock("./app-bootstrap", () => ({
  AppBootstrap: (props: {
    initialGenerationPreset: ExploreVhsTapeDetails | null;
    initialPrompt: string;
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
      initialGenerationPreset: null,
      initialPrompt: "",
      projectId: "project_1",
      threadId: null,
    });

    mocks.params.current = { threadId: "thread_1" };
    mocks.search.current = {};
    rendered.rerender(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      initialGenerationPreset: null,
      initialPrompt: "",
      projectId: null,
      threadId: "thread_1",
    });
    expect(mocks.bootstrapMounts).toHaveBeenCalledTimes(1);
  });

  it("resolves an Explore ref for a fresh workspace", () => {
    const tape = exploreVhsTapes[0];
    mocks.search.current = { exploreRef: tape.key };

    render(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      initialGenerationPreset: tape,
      initialPrompt: tape.prompt,
      projectId: null,
      threadId: null,
    });
  });

  it("resolves an artwork ref as a prompt-only workspace link", () => {
    const artwork = exploreArtworks[0];
    mocks.search.current = { exploreRef: artwork.key };

    render(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      initialGenerationPreset: null,
      initialPrompt: artwork.prompt,
      projectId: null,
      threadId: null,
    });
  });

  it("ignores an Explore ref on a thread route", () => {
    mocks.params.current = { threadId: "thread_1" };
    mocks.search.current = { exploreRef: exploreVhsTapes[0].key };

    render(<WebGenerationRoute />);

    expect(mocks.bootstrapProps).toHaveBeenLastCalledWith({
      initialGenerationPreset: null,
      initialPrompt: "",
      projectId: null,
      threadId: "thread_1",
    });
  });
});
