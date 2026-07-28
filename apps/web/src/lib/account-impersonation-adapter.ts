import type { AccountImpersonationAdapter } from "@remora/app/admin";

import { authClient } from "./auth-client";

export const accountImpersonationAdapter: AccountImpersonationAdapter = {
  async listUsers({ limit, offset, searchField, searchValue }) {
    const result = await authClient.admin.listUsers({
      query: {
        filterField: "role",
        filterOperator: "eq",
        filterValue: "user",
        limit,
        offset,
        sortBy: "createdAt",
        sortDirection: "desc",
        ...(searchValue
          ? {
              searchField,
              searchOperator: "contains" as const,
              searchValue,
            }
          : {}),
      },
    });

    if (result.error) {
      throw new Error(result.error.message ?? "Unable to list users.");
    }

    return {
      total: result.data.total,
      users: result.data.users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: toIsoDate(user.createdAt),
      })),
    };
  },

  async impersonateUser(userId) {
    const result = await authClient.admin.impersonateUser({ userId });

    if (result.error) {
      throw new Error(result.error.message ?? "Unable to impersonate user.");
    }
  },
};

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}
