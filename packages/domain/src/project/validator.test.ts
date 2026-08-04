import { describe, expect, it } from "vitest";

import {
  createProjectInputSchema,
  maxProjectNameLength,
  renameProjectInputSchema,
} from "./validator.ts";

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

describe("renameProjectInputSchema", () => {
  it("trims valid project names", () => {
    expect(
      renameProjectInputSchema.parse({
        projectId: "project_1",
        name: "  Launch concepts  ",
      }),
    ).toEqual({
      projectId: "project_1",
      name: "Launch concepts",
    });
  });

  it("rejects missing project ids and invalid names", () => {
    expect(
      renameProjectInputSchema.safeParse({ projectId: "", name: "Launch" })
        .success,
    ).toBe(false);
    expect(
      renameProjectInputSchema.safeParse({ projectId: "project_1", name: " " })
        .success,
    ).toBe(false);
    expect(
      renameProjectInputSchema.safeParse({
        projectId: "project_1",
        name: "a".repeat(maxProjectNameLength + 1),
      }).success,
    ).toBe(false);
  });
});
