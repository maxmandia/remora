import { describe, expect, it } from "vitest";

import { getFormFieldA11y, getFormFieldErrors } from "./text-field.tsx";

describe("form field helpers", () => {
  it("normalizes string errors", () => {
    expect(getFormFieldErrors(["Required"])).toEqual([{ message: "Required" }]);
  });

  it("normalizes object message errors", () => {
    expect(getFormFieldErrors([{ message: "Too long" }])).toEqual([
      { message: "Too long" },
    ]);
  });

  it("ignores unknown and empty errors", () => {
    expect(
      getFormFieldErrors([
        "",
        "   ",
        null,
        undefined,
        42,
        {},
        { message: "" },
        { message: "   " },
      ]),
    ).toEqual([]);
  });

  it("composes field accessibility ids for descriptions", () => {
    expect(
      getFormFieldA11y({
        id: "project-name",
        errors: [],
        description: "Visible when valid.",
      }),
    ).toEqual({
      errors: [],
      isInvalid: false,
      errorId: undefined,
      descriptionId: "project-name-description",
      describedBy: "project-name-description",
    });
  });

  it("prioritizes error accessibility ids over descriptions", () => {
    expect(
      getFormFieldA11y({
        id: "project-name",
        errors: ["Required"],
        description: "Visible when valid.",
      }),
    ).toEqual({
      errors: [{ message: "Required" }],
      isInvalid: true,
      errorId: "project-name-error",
      descriptionId: undefined,
      describedBy: "project-name-error",
    });
  });
});
