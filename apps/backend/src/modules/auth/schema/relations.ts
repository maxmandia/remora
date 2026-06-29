import { relations } from "drizzle-orm";

import { billingProfile } from "../../billing/schema/table.ts";
import { creditAutoTopUpSettings } from "../../credit_auto_top_up_settings/schema/table.ts";
import { creditLedgerEntry, userBalance } from "../../credits/schema/table.ts";
import { account, session, user } from "./table.ts";

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  creditBalance: one(userBalance),
  billingProfile: one(billingProfile),
  creditAutoTopUpSettings: one(creditAutoTopUpSettings),
  creditLedgerEntries: many(creditLedgerEntry),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
