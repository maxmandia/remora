import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { defaultAc } from "better-auth/plugins/admin/access";
import { beforeEach, describe, expect, it } from "vitest";

const authOrigin = "http://localhost:3000";
const authSecret = "better-auth-secret-that-is-long-enough-for-admin-tests";
const administratorRole = defaultAc.newRole({
  user: ["list", "impersonate"],
  session: [],
});
const userRole = defaultAc.newRole({
  user: [],
  session: [],
});

describe("Better Auth account impersonation", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(async () => {
    harness = createHarness();
    await harness.createUser("admin@example.test", "Administrator");
    await harness.createUser("customer@example.test", "Customer");
    await harness.createUser("other-admin@example.test", "Other Admin");
    harness.setRole("admin@example.test", "admin");
    harness.setRole("other-admin@example.test", "admin");
  });

  it("allows administrators to list ordinary users", async () => {
    const adminSession = await harness.signIn("admin@example.test");
    const response = await adminSession.fetch(
      "/admin/list-users?limit=25&offset=0&filterField=role&filterValue=user&filterOperator=eq",
    );
    const body = (await response.json()) as {
      users: Array<{ email: string; role: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.users.map((user) => user.email)).toEqual([
      "customer@example.test",
    ]);
    expect(body.users[0]?.role).toBe("user");
  });

  it("denies listing and impersonation to ordinary users", async () => {
    const userSession = await harness.signIn("customer@example.test");
    const targetId = harness.getUserId("admin@example.test");

    expect((await userSession.fetch("/admin/list-users?limit=25")).status).toBe(
      403,
    );
    expect(
      (
        await userSession.fetch("/admin/impersonate-user", {
          method: "POST",
          body: JSON.stringify({ userId: targetId }),
        })
      ).status,
    ).toBe(403);
  });

  it("uses the target identity and restores the administrator", async () => {
    const adminSession = await harness.signIn("admin@example.test");
    const adminId = harness.getUserId("admin@example.test");
    const customerId = harness.getUserId("customer@example.test");
    const impersonationResponse = await adminSession.fetch(
      "/admin/impersonate-user",
      {
        method: "POST",
        body: JSON.stringify({ userId: customerId }),
      },
    );

    expect(impersonationResponse.status).toBe(200);
    expect(adminSession.cookieNames()).toContain("better-auth.admin_session");

    const impersonatedState = await adminSession.getSession();

    expect(impersonatedState.user.id).toBe(customerId);
    expect(impersonatedState.user.role).toBe("user");
    expect(impersonatedState.session.impersonatedBy).toBe(adminId);

    const stopResponse = await adminSession.fetch("/admin/stop-impersonating", {
      method: "POST",
      body: "{}",
    });
    const restoredState = await adminSession.getSession();

    expect(stopResponse.status).toBe(200);
    expect(restoredState.user.id).toBe(adminId);
    expect(restoredState.user.role).toBe("admin");
    expect(restoredState.session.impersonatedBy).toBeFalsy();
  });

  it("rejects self and admin-to-admin impersonation", async () => {
    const adminSession = await harness.signIn("admin@example.test");

    for (const email of ["admin@example.test", "other-admin@example.test"]) {
      const response = await adminSession.fetch("/admin/impersonate-user", {
        method: "POST",
        body: JSON.stringify({ userId: harness.getUserId(email) }),
      });

      expect(response.status).toBe(403);
    }
  });

  it("forbids unrelated admin operations", async () => {
    const adminSession = await harness.signIn("admin@example.test");
    const response = await adminSession.fetch("/admin/create-user", {
      method: "POST",
      body: JSON.stringify({
        email: "created@example.test",
        name: "Created",
        password: "password123",
      }),
    });

    expect(response.status).toBe(403);
  });
});

function createHarness() {
  const database: Record<string, Record<string, unknown>[]> = {
    account: [],
    session: [],
    user: [],
    verification: [],
  };
  const auth = betterAuth({
    baseURL: authOrigin,
    database: memoryAdapter(database),
    emailAndPassword: {
      enabled: true,
    },
    plugins: [
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
        impersonationSessionDuration: 60 * 60,
        roles: {
          admin: administratorRole,
          user: userRole,
        },
      }),
    ],
    secret: authSecret,
    trustedOrigins: [authOrigin],
  });

  async function createUser(email: string, name: string) {
    const response = await auth.handler(
      new Request(`${authOrigin}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          password: "password123",
        }),
      }),
    );

    expect(response.status).toBe(200);
  }

  async function signIn(email: string) {
    const cookies = new Map<string, string>();
    const session = {
      async fetch(pathname: string, init: RequestInit = {}) {
        const response = await auth.handler(
          new Request(`${authOrigin}/api/auth${pathname}`, {
            ...init,
            headers: {
              ...init.headers,
              cookie: Array.from(cookies)
                .map(([name, value]) => `${name}=${value}`)
                .join("; "),
              "content-type": "application/json",
            },
          }),
        );

        applySetCookieHeaders(cookies, getSetCookieHeaders(response));

        return response;
      },
      async getSession() {
        const response = await session.fetch("/get-session");

        expect(response.status).toBe(200);

        return response.json() as Promise<{
          session: {
            id: string;
            impersonatedBy?: string | null;
          };
          user: {
            id: string;
            role: string;
          };
        }>;
      },
      cookieNames() {
        return Array.from(cookies.keys());
      },
    };
    const response = await session.fetch("/sign-in/email", {
      method: "POST",
      body: JSON.stringify({
        email,
        password: "password123",
      }),
    });

    expect(response.status).toBe(200);

    return session;
  }

  return {
    createUser,
    database,
    getUserId(email: string) {
      const id = database.user?.find((user) => user.email === email)?.id;

      if (typeof id !== "string") {
        throw new Error(`No user found for ${email}`);
      }

      return id;
    },
    setRole(email: string, role: "admin" | "user") {
      const user = database.user?.find(
        (candidate) => candidate.email === email,
      );

      if (!user) {
        throw new Error(`No user found for ${email}`);
      }

      user.role = role;
    },
    signIn,
  };
}

function getSetCookieHeaders(response: Response) {
  const getSetCookie = (
    response.headers as Headers & {
      getSetCookie?: () => string[];
    }
  ).getSetCookie;

  return getSetCookie?.call(response.headers) ?? [];
}

function applySetCookieHeaders(
  cookies: Map<string, string>,
  headers: readonly string[],
) {
  for (const header of headers) {
    const [pair] = header.split(";");
    const separatorIndex = pair?.indexOf("=") ?? -1;

    if (!pair || separatorIndex <= 0) {
      continue;
    }

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);

    if (!value || /;\s*max-age=0(?:;|$)/i.test(header)) {
      cookies.delete(name);
    } else {
      cookies.set(name, value);
    }
  }
}
