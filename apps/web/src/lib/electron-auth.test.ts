import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authClientMock = vi.hoisted(() => ({
  ensureElectronRedirect: vi.fn(),
  getAuthorizationCode: vi.fn(),
  transferUser: vi.fn(),
}));

vi.mock("./auth-client", () => ({
  authClient: {
    ensureElectronRedirect: authClientMock.ensureElectronRedirect,
    electron: {
      getAuthorizationCode: authClientMock.getAuthorizationCode,
      transferUser: authClientMock.transferUser,
    },
  },
}));

import {
  getElectronFetchOptions,
  createLoopbackAuthCallbackUrl,
  parseElectronAuthSearch,
  restartElectronRedirect,
  stopElectronRedirect,
  transferElectronUser,
} from "./electron-auth";

const electronSearch = {
  client_id: "electron",
  state: "state",
  code_challenge: "challenge",
  code_challenge_method: "S256",
};

describe("Electron auth helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    authClientMock.ensureElectronRedirect.mockImplementation(() =>
      setInterval(() => undefined, 1000),
    );
    authClientMock.transferUser.mockResolvedValue({});
  });

  afterEach(() => {
    stopElectronRedirect();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("parses only supported Electron auth search params", () => {
    expect(
      parseElectronAuthSearch({
        ...electronSearch,
        ignored: "value",
        empty: "",
      }),
    ).toEqual(electronSearch);
  });

  it("parses valid loopback transport params and rejects invalid pairs", () => {
    const nonce = "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678";

    expect(
      parseElectronAuthSearch({
        ...electronSearch,
        desktop_callback_port: "49152",
        desktop_callback_nonce: nonce,
      }),
    ).toEqual({
      ...electronSearch,
      desktop_callback_port: "49152",
      desktop_callback_nonce: nonce,
    });
    expect(
      parseElectronAuthSearch({
        ...electronSearch,
        desktop_callback_port: "70000",
        desktop_callback_nonce: nonce,
      }),
    ).toEqual(electronSearch);
  });

  it("builds fetch options only for complete Electron auth searches", () => {
    expect(getElectronFetchOptions(electronSearch)).toEqual({
      query: electronSearch,
    });
    expect(getElectronFetchOptions({ state: "state" })).toBeUndefined();
  });

  it("keeps loopback transport params out of Better Auth requests", () => {
    expect(
      getElectronFetchOptions({
        ...electronSearch,
        desktop_callback_port: "49152",
        desktop_callback_nonce: "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
      }),
    ).toEqual({ query: electronSearch });
  });

  it("builds loopback authentication callback URLs", () => {
    expect(
      createLoopbackAuthCallbackUrl(
        {
          desktop_callback_port: "49152",
          desktop_callback_nonce: "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
        },
        "authorization token",
      ),
    ).toBe(
      "http://127.0.0.1:49152/callbacks/auth/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678?token=authorization+token",
    );
  });

  it("consumes authorization codes before redirecting to loopback", () => {
    const replace = vi.fn();
    const document = { cookie: "better-auth.electron=authorization-code" };
    vi.stubGlobal("document", document);
    vi.stubGlobal("window", { location: { replace } });
    authClientMock.getAuthorizationCode.mockReturnValue("authorization-code");

    restartElectronRedirect(
      {
        desktop_callback_port: "49152",
        desktop_callback_nonce: "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
      },
      { interval: 100 },
    );
    vi.advanceTimersByTime(100);

    expect(document.cookie).toContain("expires=Thu, 01 Jan 1970");
    expect(replace).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/callbacks/auth/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678?token=authorization-code",
    );
  });

  it("transfers Electron users and restarts redirect polling", async () => {
    await transferElectronUser(electronSearch);

    expect(authClientMock.transferUser).toHaveBeenCalledWith({
      fetchOptions: {
        query: electronSearch,
      },
    });
    expect(authClientMock.ensureElectronRedirect).toHaveBeenCalledTimes(1);
  });

  it("does not transfer users without Electron auth search params", async () => {
    await transferElectronUser({});

    expect(authClientMock.transferUser).not.toHaveBeenCalled();
    expect(authClientMock.ensureElectronRedirect).not.toHaveBeenCalled();
  });

  it("keeps only the latest redirect poller active", () => {
    restartElectronRedirect();
    restartElectronRedirect();

    expect(vi.getTimerCount()).toBe(1);
  });
});
