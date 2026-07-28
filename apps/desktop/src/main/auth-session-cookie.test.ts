import { describe, expect, it } from "vitest";

import {
  applyAuthSetCookieHeaders,
  createAuthCookieJar,
  getAuthCookieHeader,
  normalizeStoredAuthCookieJar,
} from "./auth-session-cookie.ts";

describe("desktop auth cookie jar", () => {
  it("preserves all Better Auth cookies", () => {
    const cookies = applyAuthSetCookieHeaders({}, [
      "better-auth.session_token=signed-token; Path=/; HttpOnly",
      "better-auth.admin_session=restore-token; Path=/; HttpOnly",
    ]);

    expect(getAuthCookieHeader(cookies)).toBe(
      "better-auth.session_token=signed-token; better-auth.admin_session=restore-token",
    );
  });

  it("preserves secure Better Auth cookies", () => {
    const cookies = applyAuthSetCookieHeaders(
      {},
      "__Secure-better-auth.session_token=signed-token; Path=/; HttpOnly; Secure",
    );

    expect(getAuthCookieHeader(cookies)).toBe(
      "__Secure-better-auth.session_token=signed-token",
    );
  });

  it("reads the legacy single-cookie format", () => {
    expect(
      createAuthCookieJar("better-auth.session_token=signed-token"),
    ).toEqual({
      "better-auth.session_token": "signed-token",
    });
  });

  it("normalizes legacy and current encrypted-session payloads", () => {
    expect(
      normalizeStoredAuthCookieJar({
        cookie: "better-auth.session_token=legacy",
      }),
    ).toEqual({
      "better-auth.session_token": "legacy",
    });
    expect(
      normalizeStoredAuthCookieJar({
        cookies: {
          "better-auth.admin_session": "restore",
          "better-auth.session_token": "effective",
          unrelated: "ignored",
        },
      }),
    ).toEqual({
      "better-auth.admin_session": "restore",
      "better-auth.session_token": "effective",
    });
  });

  it("applies expirations without removing other cookies", () => {
    const cookies = applyAuthSetCookieHeaders(
      {
        "better-auth.session_token": "signed-token",
        "better-auth.admin_session": "restore-token",
      },
      "better-auth.session_token=; Path=/; Max-Age=0",
    );

    expect(cookies).toEqual({
      "better-auth.admin_session": "restore-token",
    });
  });

  it("ignores unrelated cookies", () => {
    expect(
      applyAuthSetCookieHeaders({}, [
        "other=value; Path=/",
        "unrelated=value; Path=/",
      ]),
    ).toEqual({});
  });

  it("handles missing and empty headers", () => {
    expect(applyAuthSetCookieHeaders({}, null)).toEqual({});
    expect(applyAuthSetCookieHeaders({}, undefined)).toEqual({});
    expect(applyAuthSetCookieHeaders({}, "")).toEqual({});
  });
});
