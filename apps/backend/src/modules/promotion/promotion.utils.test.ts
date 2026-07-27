import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  guestGenerationPromotionAmountUsdMicros,
  guestGenerationPromotionOfferVersion,
  guestGenerationPromotionTicketLifetimeMs,
  InvalidPromotionTicketError,
  promotionTicketSchemaVersion,
} from "./promotion.types.ts";
import {
  createPromotionTicket,
  verifyPromotionTicket,
} from "./promotion.utils.ts";

const secret = "promotion-signing-secret-with-32-characters";
const issuedAt = new Date("2026-07-26T12:00:00.000Z");
const ticketId = "11111111-1111-4111-8111-111111111111";

describe("promotion ticket utilities", () => {
  it("creates and verifies a fixed 24-hour promotion ticket", () => {
    const { payload, ticket } = createPromotionTicket({
      issuedAt,
      secret,
      ticketId,
    });

    expect(payload).toEqual({
      schemaVersion: promotionTicketSchemaVersion,
      ticketId,
      offerVersion: guestGenerationPromotionOfferVersion,
      amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
      issuedAtMs: issuedAt.getTime(),
      expiresAtMs:
        issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
    });
    expect(
      verifyPromotionTicket({
        ticket,
        secret,
        now: new Date(issuedAt.getTime() + 1),
      }),
    ).toEqual(payload);
  });

  it.each([
    "",
    "not-a-ticket",
    "payload.signature.extra",
    "invalid-base64.invalid-base64",
  ])("rejects malformed ticket %j", (ticket) => {
    expect(() =>
      verifyPromotionTicket({ ticket, secret, now: issuedAt }),
    ).toThrow(InvalidPromotionTicketError);
  });

  it("rejects altered payloads and signatures", () => {
    const { ticket } = createPromotionTicket({
      issuedAt,
      secret,
      ticketId,
    });
    const [payload, signature] = ticket.split(".");

    expect(() =>
      verifyPromotionTicket({
        ticket: `${payload}a.${signature}`,
        secret,
        now: issuedAt,
      }),
    ).toThrow(InvalidPromotionTicketError);
    expect(() =>
      verifyPromotionTicket({
        ticket: `${payload}.${signature}a`,
        secret,
        now: issuedAt,
      }),
    ).toThrow(InvalidPromotionTicketError);
  });

  it("rejects tickets verified with another secret", () => {
    const { ticket } = createPromotionTicket({
      issuedAt,
      secret,
      ticketId,
    });

    expect(() =>
      verifyPromotionTicket({
        ticket,
        secret: "another-promotion-signing-secret-32-chars",
        now: issuedAt,
      }),
    ).toThrow(InvalidPromotionTicketError);
  });

  it("rejects future-issued and expired tickets", () => {
    const { ticket } = createPromotionTicket({
      issuedAt,
      secret,
      ticketId,
    });

    expect(() =>
      verifyPromotionTicket({
        ticket,
        secret,
        now: new Date(issuedAt.getTime() - 1),
      }),
    ).toThrow(InvalidPromotionTicketError);
    expect(() =>
      verifyPromotionTicket({
        ticket,
        secret,
        now: new Date(
          issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
        ),
      }),
    ).toThrow(InvalidPromotionTicketError);
  });

  it.each([
    {
      field: "schemaVersion",
      value: 2,
    },
    {
      field: "offerVersion",
      value: "guest_generation_v2",
    },
    {
      field: "amountUsdMicros",
      value: guestGenerationPromotionAmountUsdMicros + 1,
    },
    {
      field: "expiresAtMs",
      value: issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs + 1,
    },
  ])("rejects signed payloads with invalid $field", ({ field, value }) => {
    const payload = {
      schemaVersion: promotionTicketSchemaVersion,
      ticketId,
      offerVersion: guestGenerationPromotionOfferVersion,
      amountUsdMicros: guestGenerationPromotionAmountUsdMicros,
      issuedAtMs: issuedAt.getTime(),
      expiresAtMs:
        issuedAt.getTime() + guestGenerationPromotionTicketLifetimeMs,
      [field]: value,
    };

    expect(() =>
      verifyPromotionTicket({
        ticket: signPayload(payload),
        secret,
        now: issuedAt,
      }),
    ).toThrow(InvalidPromotionTicketError);
  });
});

function signPayload(payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}
