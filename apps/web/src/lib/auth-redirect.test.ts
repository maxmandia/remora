import { describe, expect, it, vi } from "vitest";

import {
  continueWebAuth,
  getAuthRedirect,
  parseAuthSearch,
} from "./auth-redirect";

vi.mock("./auth-client", () => ({
  authClient: {},
}));

const electronSearch = {
  client_id: "electron",
  state: "state",
  code_challenge: "challenge",
  code_challenge_method: "S256",
};

describe("auth redirects", () => {
  it("defaults normal web authentication to the app", () => {
    const search = parseAuthSearch({});

    expect(search).toEqual({});
    expect(getAuthRedirect(search)).toBe("/app");
  });

  it.each([
    ["/app", "/app"],
    ["/app/", "/app/"],
    ["/app/threads/thread_1", "/app/threads/thread_1"],
    [
      "/app/threads/thread_1?projectId=project_1#result",
      "/app/threads/thread_1?projectId=project_1#result",
    ],
  ])("preserves a supported app destination: %s", (redirect, expected) => {
    const search = parseAuthSearch({ redirect });

    expect(search.redirect).toBe(expected);
    expect(getAuthRedirect(search)).toBe(expected);
  });

  it.each([
    "",
    " /app",
    "app",
    "/",
    "/pricing",
    "/application",
    "//evil.example/app",
    "https://evil.example/app",
    "javascript:alert(1)",
    "app.remora.desktop:/",
    42,
  ])("rejects an unsafe or unsupported destination: %s", (redirect) => {
    const search = parseAuthSearch({ redirect });

    expect(search).toEqual({});
    expect(getAuthRedirect(search)).toBe("/app");
  });

  it("preserves Electron authentication while retaining a web destination", () => {
    expect(
      parseAuthSearch({
        ...electronSearch,
        redirect: "/app/settings",
        ignored: "value",
      }),
    ).toEqual({
      ...electronSearch,
      redirect: "/app/settings",
    });
  });

  it("preserves only an explicit guest-generation handoff marker", () => {
    expect(
      parseAuthSearch({
        guestGeneration: "true",
        redirect: "/app",
      }),
    ).toEqual({
      guestGeneration: true,
      redirect: "/app",
    });
    expect(parseAuthSearch({ guestGeneration: "false" })).toEqual({});
  });

  it("allows the check-email gate as a narrow authentication destination", () => {
    expect(getAuthRedirect(parseAuthSearch({ redirect: "/check-email" }))).toBe(
      "/check-email",
    );
    expect(
      getAuthRedirect(
        parseAuthSearch({ redirect: "/check-email?error=TOKEN_EXPIRED" }),
      ),
    ).toBe("/check-email?error=TOKEN_EXPIRED");
  });

  it("continues web authentication at the validated destination", () => {
    const assign = vi.fn();

    continueWebAuth(
      parseAuthSearch({ redirect: "/app/settings?tab=credits" }),
      assign,
    );

    expect(assign).toHaveBeenCalledWith("/app/settings?tab=credits");
  });
});
