import { describe, expect, it } from "vitest";

import { createProjectInputSchema, maxProjectNameLength } from "./validator.ts";

describe("project domain validator", () => {
  it("trims valid project names", () => {
    expect(
      createProjectInputSchema.parse({
        name: "  Launch concepts  ",
      }),
    ).toEqual({
      name: "Launch concepts",
    });
  });

  it("rejects empty project names", () => {
    expect(
      createProjectInputSchema.safeParse({
        name: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects project names longer than the maximum length", () => {
    expect(
      createProjectInputSchema.safeParse({
        name: "a".repeat(maxProjectNameLength + 1),
      }).success,
    ).toBe(false);
  });
});
