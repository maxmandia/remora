import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { billingProfile } from "./table.ts";

export const billingProfileRelations = relations(billingProfile, ({ one }) => ({
  user: one(user, {
    fields: [billingProfile.userId],
    references: [user.id],
  }),
}));
