import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { creditLedgerEntry } from "../../credits/schema/table.ts";
import { promotionClaim } from "./table.ts";

export const promotionClaimRelations = relations(promotionClaim, ({ one }) => ({
  user: one(user, {
    fields: [promotionClaim.userId],
    references: [user.id],
  }),
  creditLedgerEntry: one(creditLedgerEntry, {
    fields: [promotionClaim.creditLedgerEntryId],
    references: [creditLedgerEntry.id],
  }),
}));
