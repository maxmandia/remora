import { z } from "zod";

export const maxProjectNameLength = 50;

const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a project name.")
  .max(
    maxProjectNameLength,
    `Project name must be ${maxProjectNameLength} characters or fewer.`,
  );

export const createProjectInputSchema = z.object({
  name: projectNameSchema,
});

export const renameProjectInputSchema = z.object({
  projectId: z.string().min(1, "Project is required."),
  name: projectNameSchema,
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
export type RenameProjectInput = z.infer<typeof renameProjectInputSchema>;
