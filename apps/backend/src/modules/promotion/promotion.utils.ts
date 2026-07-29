import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  guestGenerationPromotionAmountUsdMicros,
  guestGenerationPromotionOfferVersion,
  guestGenerationPromotionTicketLifetimeMs,
  InvalidPromotionTicketError,
  promotionOffers,
  promotionOfferVersions,
  promotionTicketSchemaVersion,
  type PromotionTicketPayload,
} from "./promotion.types.ts";

const promotionTicketPayloadSchema = z.strictObject({
  schemaVersion: z.literal(promotionTicketSchemaVersion),
  ticketId: z.uuid(),
  offerVersion: z.enum(promotionOfferVersions),
  amountUsdMicros: z.number().int().positive().safe(),
  issuedAtMs: z.number().int().nonnegative().safe(),
  expiresAtMs: z.number().int().nonnegative().safe(),
});

export function createPromotionTicket({
  issuedAt,
  secret,
  ticketId,
}: {
  issuedAt: Date;
  secret: string;
  ticketId: string;
}) {
  const payload: PromotionTicketPayload = {
    schemaVersion: promotionTicketSchemaVersion,
    ticketId,
    offerVersion: guestGenerationPromotionOfferVersion,
    amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
    issuedAtMs: issuedAt.getTime(),
    expiresAtMs: issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return {
    payload,
    ticket: `${encodedPayload}.${signPayload(encodedPayload, secret).toString("base64url")}`,
  };
}

export function verifyPromotionTicket({
  now,
  secret,
  ticket,
}: {
  now: Date;
  secret: string;
  ticket: string;
}): PromotionTicketPayload {
  try {
    const parts = ticket.split(".");

    if (parts.length !== 2) {
      throw new InvalidPromotionTicketError();
    }

    const [encodedPayload, encodedSignature] = parts;

    if (!encodedPayload || !encodedSignature) {
      throw new InvalidPromotionTicketError();
    }

    const actualSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = signPayload(encodedPayload, secret);

    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw new InvalidPromotionTicketError();
    }

    const parsedPayload = promotionTicketPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    );

    if (
      parsedPayload.amountUsdMicros !==
        promotionOffers[parsedPayload.offerVersion].amountUsdMicros ||
      parsedPayload.expiresAtMs - parsedPayload.issuedAtMs !==
        guestGenerationPromotionTicketLifetimeMs ||
      parsedPayload.issuedAtMs > now.getTime() ||
      parsedPayload.expiresAtMs <= now.getTime()
    ) {
      throw new InvalidPromotionTicketError();
    }

    return parsedPayload;
  } catch (error) {
    if (error instanceof InvalidPromotionTicketError) {
      throw error;
    }

    throw new InvalidPromotionTicketError();
  }
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest();
}
