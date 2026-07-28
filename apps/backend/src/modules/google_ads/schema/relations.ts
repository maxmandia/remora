import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { creditLedgerEntry } from "../../credits/schema/table.ts";
import {
  googleAdsClickAttribution,
  googleAdsPurchaseConversion,
} from "./table.ts";

export const googleAdsClickAttributionRelations = relations(
  googleAdsClickAttribution,
  ({ one, many }) => ({
    user: one(user, {
      fields: [googleAdsClickAttribution.userId],
      references: [user.id],
    }),
    purchaseConversions: many(googleAdsPurchaseConversion),
  }),
);

export const googleAdsPurchaseConversionRelations = relations(
  googleAdsPurchaseConversion,
  ({ one }) => ({
    user: one(user, {
      fields: [googleAdsPurchaseConversion.userId],
      references: [user.id],
    }),
    attribution: one(googleAdsClickAttribution, {
      fields: [googleAdsPurchaseConversion.attributionId],
      references: [googleAdsClickAttribution.id],
    }),
    creditLedgerEntry: one(creditLedgerEntry, {
      fields: [googleAdsPurchaseConversion.creditLedgerEntryId],
      references: [creditLedgerEntry.id],
    }),
  }),
);
