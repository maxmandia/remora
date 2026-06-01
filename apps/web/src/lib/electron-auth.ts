import { useEffect } from "react"

import { authClient } from "./auth-client"

const electronAuthKeys = [
  "client_id",
  "state",
  "code_challenge",
  "code_challenge_method",
] as const

export type ElectronAuthSearch = Partial<
  Record<(typeof electronAuthKeys)[number], string>
>

export function parseElectronAuthSearch(
  search: Record<string, unknown>,
): ElectronAuthSearch {
  const parsed: ElectronAuthSearch = {}

  for (const key of electronAuthKeys) {
    const value = search[key]

    if (typeof value === "string" && value.length > 0) {
      parsed[key] = value
    }
  }

  return parsed
}

export function hasElectronAuthSearch(search: ElectronAuthSearch) {
  return Boolean(search.client_id && search.state && search.code_challenge)
}

export function getElectronFetchOptions(search: ElectronAuthSearch) {
  if (!hasElectronAuthSearch(search)) {
    return undefined
  }

  return {
    query: search,
  }
}

export function useElectronRedirect() {
  useEffect(() => {
    const redirectInterval = authClient.ensureElectronRedirect()

    return () => {
      clearInterval(redirectInterval)
    }
  }, [])
}

export async function transferElectronUser(search: ElectronAuthSearch) {
  const fetchOptions = getElectronFetchOptions(search)

  if (!fetchOptions) {
    return
  }

  await authClient.electron.transferUser({
    fetchOptions,
  })
}
