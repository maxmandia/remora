import type { FastifyInstance } from "fastify";

import { generationReferenceMediaService } from "./generation-reference-media.service.ts";
import {
  generationReferenceMediaKinds,
  GenerationReferenceMediaValidationError,
} from "./generation-reference-media.types.ts";

export async function registerGenerationReferenceMediaUploadRoutes(
  server: FastifyInstance,
) {
  server.post("/api/generation/reference-media", async (request, reply) => {
    const { getSessionFromHeaders } = await import("../auth/auth.ts");
    const session = await getSessionFromHeaders(request.headers);

    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const fields: Record<string, string> = {};
    let uploadedMedia: Awaited<
      ReturnType<
        typeof generationReferenceMediaService.uploadGenerationReferenceMedia
      >
    > | null = null;

    try {
      for await (const part of request.parts()) {
        if (part.type === "field") {
          fields[part.fieldname] = String(part.value ?? "");
          continue;
        }

        if (uploadedMedia) {
          part.file.resume();
          return reply.status(400).send({
            error: "Only one reference media file can be uploaded at a time",
          });
        }

        uploadedMedia =
          await generationReferenceMediaService.uploadGenerationReferenceMedia({
            userId: session.user.id,
            kind: parseReferenceMediaKind(requireUploadField(fields, "kind")),
            originalFileName: part.filename,
            contentType: part.mimetype,
            contentLength: null,
            body: part.file,
          });
      }
    } catch (error) {
      if (error instanceof GenerationReferenceMediaValidationError) {
        return reply.status(400).send({
          error: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    if (!uploadedMedia) {
      return reply.status(400).send({ error: "Missing reference media file" });
    }

    return reply.send(uploadedMedia);
  });
}

function requireUploadField(fields: Record<string, string>, fieldName: string) {
  const value = fields[fieldName]?.trim();

  if (!value) {
    throw new GenerationReferenceMediaValidationError(
      fieldName,
      `${fieldName} is required`,
    );
  }

  return value;
}

function parseReferenceMediaKind(kind: string) {
  if ((generationReferenceMediaKinds as readonly string[]).includes(kind)) {
    return kind as (typeof generationReferenceMediaKinds)[number];
  }

  throw new GenerationReferenceMediaValidationError(
    "kind",
    "kind must be a supported reference media kind",
  );
}
