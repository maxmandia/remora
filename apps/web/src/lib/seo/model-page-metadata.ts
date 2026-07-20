import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const modelPageMetadataSchema = z
  .object({
    slug: z.string().regex(slugPattern),
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    developer: z.string().trim().min(1),
    provider: z.string().trim().min(1).optional(),
    family: z.string().trim().min(1),
    variant: z.string().trim().min(1),
    modality: z.enum(["image", "video"]),
    facts: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          value: z.string().trim().min(1),
        }),
      )
      .min(3),
    publicationStatus: z.enum(["draft", "published"]),
    publishedAt: z.string().regex(isoDatePattern).optional(),
    updatedAt: z.string().regex(isoDatePattern),
    sources: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          url: z.url().refine((value) => new URL(value).protocol === "https:", {
            message: "Source URLs must use HTTPS",
          }),
        }),
      )
      .optional(),
  })
  .superRefine((metadata, context) => {
    if (metadata.publicationStatus === "published" && !metadata.publishedAt) {
      context.addIssue({
        code: "custom",
        message: "Published model pages require publishedAt",
        path: ["publishedAt"],
      });
    }

    for (const field of ["publishedAt", "updatedAt"] as const) {
      const value = metadata[field];
      if (value && !isIsoCalendarDate(value)) {
        context.addIssue({
          code: "custom",
          message: `${field} must be a valid date`,
          path: [field],
        });
      }
    }

    const factLabels = metadata.facts.map(({ label }) =>
      label.trim().toLocaleLowerCase("en-US"),
    );
    if (new Set(factLabels).size !== factLabels.length) {
      context.addIssue({
        code: "custom",
        message: "Fact labels must be unique",
        path: ["facts"],
      });
    }
  });

export type ModelPageMetadata = z.infer<typeof modelPageMetadataSchema>;

export function parseModelPageMetadata(value: unknown) {
  return modelPageMetadataSchema.parse(value);
}

function isIsoCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
