import { eq } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";

export class AuthRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async getUserById(userId: string) {
    const user = await this.executor.query.user.findFirst({
      columns: {
        id: true,
        createdAt: true,
        emailVerified: true,
      },
      where: (table, { eq }) => eq(table.id, userId),
    });

    return user ?? null;
  }

  async deleteUserById(userId: string) {
    await this.executor.delete(schema.user).where(eq(schema.user.id, userId));
  }
}

export const authRepository = new AuthRepository();
