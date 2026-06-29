import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { creditAutoTopUpSettings } from "./table.ts";

export const creditAutoTopUpSettingsRelations = relations(
  creditAutoTopUpSettings,
  ({ one }) => ({
    user: one(user, {
      fields: [creditAutoTopUpSettings.userId],
      references: [user.id],
    }),
  }),
);
