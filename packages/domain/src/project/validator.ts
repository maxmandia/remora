import { z } from "zod";

export const maxProjectNameLength = 50;

export const createProjectInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a project name.")
    .max(
      maxProjectNameLength,
      `Project name must be ${maxProjectNameLength} characters or fewer.`,
    ),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
