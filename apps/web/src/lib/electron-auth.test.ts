import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authClientMock = vi.hoisted(() => ({
  ensureElectronRedirect: vi.fn(),
  transferUser: vi.fn(),
}))

vi.mock("./auth-client", () => ({
  authClient: {
    ensureElectronRedirect: authClientMock.ensureElectronRedirect,
    electron: {
      transferUser: authClientMock.transferUser,
    },
  },
}))

import {
  getElectronFetchOptions,
  parseElectronAuthSearch,
  restartElectronRedirect,
  stopElectronRedirect,
  transferElectronUser,
} from "./electron-auth"

const electronSearch = {
  client_id: "electron",
  state: "state",
  code_challenge: "challenge",
  code_challenge_method: "S256",
}

describe("Electron auth helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authClientMock.ensureElectronRedirect.mockImplementation(() =>
      setInterval(() => undefined, 1000),
    )
    authClientMock.transferUser.mockResolvedValue({})
  })

  afterEach(() => {
    stopElectronRedirect()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("parses only supported Electron auth search params", () => {
    expect(
      parseElectronAuthSearch({
        ...electronSearch,
        ignored: "value",
        empty: "",
      }),
    ).toEqual(electronSearch)
  })

  it("builds fetch options only for complete Electron auth searches", () => {
    expect(getElectronFetchOptions(electronSearch)).toEqual({
      query: electronSearch,
    })
    expect(getElectronFetchOptions({ state: "state" })).toBeUndefined()
  })

  it("transfers Electron users and restarts redirect polling", async () => {
    await transferElectronUser(electronSearch)

    expect(authClientMock.transferUser).toHaveBeenCalledWith({
      fetchOptions: {
        query: electronSearch,
      },
    })
    expect(authClientMock.ensureElectronRedirect).toHaveBeenCalledTimes(1)
  })

  it("does not transfer users without Electron auth search params", async () => {
    await transferElectronUser({})

    expect(authClientMock.transferUser).not.toHaveBeenCalled()
    expect(authClientMock.ensureElectronRedirect).not.toHaveBeenCalled()
  })

  it("keeps only the latest redirect poller active", () => {
    restartElectronRedirect()
    restartElectronRedirect()

    expect(vi.getTimerCount()).toBe(1)
  })
})
