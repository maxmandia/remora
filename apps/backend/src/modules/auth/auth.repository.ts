import { eq } from "drizzle-orm";

import { db, schema } from "../../db/client.ts";

export class AuthRepository {
  async deleteUserById(userId: string) {
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  }
}

export const authRepository = new AuthRepository();
