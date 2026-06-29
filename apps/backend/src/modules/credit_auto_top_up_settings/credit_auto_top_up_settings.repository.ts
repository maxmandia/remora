import { eq } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type { CreditAutoTopUpSettingsRecord } from "./credit_auto_top_up_settings.types.ts";

export class CreditAutoTopUpSettingsRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async createDefaultSettings({
    userId,
  }: {
    userId: string;
  }): Promise<{ userId: string }> {
    const [settings] = await this.executor
      .insert(schema.creditAutoTopUpSettings)
      .values({
        userId,
        enabled: false,
        topUpFloorUsdMicros: 0,
        topUpAmountUsdMicros: 0,
      })
      .returning({
        userId: schema.creditAutoTopUpSettings.userId,
      });

    if (!settings) {
      throw new Error("Credit auto top-up settings were not created");
    }

    return settings;
  }

  async getSettingsByUserId(
    userId: string,
  ): Promise<CreditAutoTopUpSettingsRecord | null> {
    const [settings] = await this.executor
      .select({
        userId: schema.creditAutoTopUpSettings.userId,
        enabled: schema.creditAutoTopUpSettings.enabled,
        topUpFloorUsdMicros: schema.creditAutoTopUpSettings.topUpFloorUsdMicros,
        topUpAmountUsdMicros:
          schema.creditAutoTopUpSettings.topUpAmountUsdMicros,
      })
      .from(schema.creditAutoTopUpSettings)
      .where(eq(schema.creditAutoTopUpSettings.userId, userId))
      .limit(1);

    return settings ?? null;
  }

  async updateSettings({
    enabled,
    topUpAmountUsdMicros,
    topUpFloorUsdMicros,
    userId,
  }: {
    enabled: boolean;
    topUpAmountUsdMicros: number;
    topUpFloorUsdMicros: number;
    userId: string;
  }): Promise<{ userId: string }> {
    const [settings] = await this.executor
      .update(schema.creditAutoTopUpSettings)
      .set({
        enabled,
        topUpAmountUsdMicros,
        topUpFloorUsdMicros,
        updatedAt: new Date(),
      })
      .where(eq(schema.creditAutoTopUpSettings.userId, userId))
      .returning({
        userId: schema.creditAutoTopUpSettings.userId,
      });

    if (!settings) {
      throw new Error(
        `Credit auto top-up settings were not found for user ${userId}`,
      );
    }

    return settings;
  }
}

export const creditAutoTopUpSettingsRepository =
  new CreditAutoTopUpSettingsRepository();
