export const electronAuthCallbackPath = '/auth/callback'

type ElectronAuthDeepLinkOptions = {
  protocolScheme: string
  callbackPath?: string
}

export function getElectronAuthTokenFromDeepLink(
  url: string,
  {
    protocolScheme,
    callbackPath = electronAuthCallbackPath,
  }: ElectronAuthDeepLinkOptions,
) {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== `${protocolScheme}:`) {
      return null
    }

    if (getCustomProtocolPath(parsed) !== callbackPath) {
      return null
    }

    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
    const token = new URLSearchParams(hash).get('token')

    return token && token.length > 0 ? token : null
  } catch {
    return null
  }
}

function getCustomProtocolPath(parsed: URL) {
  if (!parsed.host) {
    return parsed.pathname
  }

  return `/${parsed.host}${parsed.pathname}`
}
