import { describe, expect, it } from "vitest";

import { parseGenerationWorkspaceSearch } from "./generation-workspace-search.ts";

describe("parseGenerationWorkspaceSearch", () => {
  it("preserves a non-empty project ID", () => {
    expect(
      parseGenerationWorkspaceSearch({
        projectId: "project_1",
        unsupported: "value",
      }),
    ).toEqual({ projectId: "project_1" });
  });

  it.each([{}, { projectId: "" }, { projectId: null }, { projectId: 1 }])(
    "omits an invalid project ID from %o",
    (search) => {
      expect(parseGenerationWorkspaceSearch(search)).toEqual({});
    },
  );
});
