import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { generationJob } from "../../generation/schema/table.ts";
import { creditLedgerEntry, userBalance } from "./table.ts";

export const userBalanceRelations = relations(userBalance, ({ one }) => ({
  user: one(user, {
    fields: [userBalance.userId],
    references: [user.id],
  }),
}));

export const creditLedgerEntryRelations = relations(
  creditLedgerEntry,
  ({ one }) => ({
    user: one(user, {
      fields: [creditLedgerEntry.userId],
      references: [user.id],
    }),
    generationJob: one(generationJob, {
      fields: [creditLedgerEntry.generationJobId],
      references: [generationJob.id],
    }),
  }),
);
