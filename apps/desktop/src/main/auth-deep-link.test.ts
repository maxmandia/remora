import { describe, expect, it } from 'vitest'

import { getElectronAuthTokenFromDeepLink } from './auth-deep-link.ts'

const protocolScheme = 'app.remora.desktop'

describe('getElectronAuthTokenFromDeepLink', () => {
  it('extracts tokens from two-slash Electron callback URLs', () => {
    expect(
      getElectronAuthTokenFromDeepLink(
        'app.remora.desktop://auth/callback#token=abc',
        { protocolScheme },
      ),
    ).toBe('abc')
  })

  it('extracts tokens from one-slash Electron callback URLs', () => {
    expect(
      getElectronAuthTokenFromDeepLink(
        'app.remora.desktop:/auth/callback#token=abc',
        { protocolScheme },
      ),
    ).toBe('abc')
  })

  it('rejects callback URLs with the wrong scheme', () => {
    expect(
      getElectronAuthTokenFromDeepLink(
        'other.remora.desktop://auth/callback#token=abc',
        { protocolScheme },
      ),
    ).toBeNull()
  })

  it('rejects callback URLs with the wrong path', () => {
    expect(
      getElectronAuthTokenFromDeepLink('app.remora.desktop://auth/other#token=abc', {
        protocolScheme,
      }),
    ).toBeNull()
  })

  it('rejects callback URLs without a token', () => {
    expect(
      getElectronAuthTokenFromDeepLink('app.remora.desktop://auth/callback', {
        protocolScheme,
      }),
    ).toBeNull()
  })
})
