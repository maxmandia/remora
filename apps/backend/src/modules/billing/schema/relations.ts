import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { billingProfile, creditAutoTopUpSettings } from "./table.ts";

export const billingProfileRelations = relations(
  billingProfile,
  ({ one }) => ({
    user: one(user, {
      fields: [billingProfile.userId],
      references: [user.id],
    }),
  }),
);

export const creditAutoTopUpSettingsRelations = relations(
  creditAutoTopUpSettings,
  ({ one }) => ({
    user: one(user, {
      fields: [creditAutoTopUpSettings.userId],
      references: [user.id],
    }),
  }),
);
