import type { FastifyInstance } from "fastify";

import { generationAttachmentMediaService } from "../../app.service.ts";
import {
  generationAttachmentMediaKinds,
  GenerationAttachmentMediaValidationError,
} from "./generation-attachment-media.types.ts";

export async function registerGenerationAttachmentMediaUploadRoutes(
  server: FastifyInstance,
) {
  server.post("/api/generation/attachment-media", async (request, reply) => {
    const { getSessionFromHeaders } = await import("../auth/auth.ts");
    const session = await getSessionFromHeaders(request.headers);

    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const fields: Record<string, string> = {};
    let uploadedMedia: Awaited<
      ReturnType<
        typeof generationAttachmentMediaService.uploadGenerationAttachmentMedia
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
            error: "Only one attachment media file can be uploaded at a time",
          });
        }

        uploadedMedia =
          await generationAttachmentMediaService.uploadGenerationAttachmentMedia({
            userId: session.user.id,
            kind: parseAttachmentMediaKind(requireUploadField(fields, "kind")),
            originalFileName: part.filename,
            contentType: part.mimetype,
            contentLength: null,
            body: part.file,
          });
      }
    } catch (error) {
      if (error instanceof GenerationAttachmentMediaValidationError) {
        return reply.status(400).send({
          error: error.code,
          message: error.message,
        });
      }

      throw error;
    }

    if (!uploadedMedia) {
      return reply.status(400).send({ error: "Missing attachment media file" });
    }

    return reply.send(uploadedMedia);
  });
}

function requireUploadField(fields: Record<string, string>, fieldName: string) {
  const value = fields[fieldName]?.trim();

  if (!value) {
    throw new GenerationAttachmentMediaValidationError(
      fieldName,
      `${fieldName} is required`,
    );
  }

  return value;
}

function parseAttachmentMediaKind(kind: string) {
  if ((generationAttachmentMediaKinds as readonly string[]).includes(kind)) {
    return kind as (typeof generationAttachmentMediaKinds)[number];
  }

  throw new GenerationAttachmentMediaValidationError(
    "kind",
    "kind must be a supported attachment media kind",
  );
}
