import { describe, expect, it } from 'vitest'

import { getSessionCookieFromSetCookieHeader } from './auth-session-cookie.ts'

describe('getSessionCookieFromSetCookieHeader', () => {
  it('extracts the Better Auth session cookie', () => {
    expect(
      getSessionCookieFromSetCookieHeader(
        'better-auth.session_token=signed-token; Path=/; HttpOnly; SameSite=Lax',
      ),
    ).toBe('better-auth.session_token=signed-token')
  })

  it('extracts secure Better Auth session cookies', () => {
    expect(
      getSessionCookieFromSetCookieHeader(
        '__Secure-better-auth.session_token=signed-token; Path=/; HttpOnly; Secure',
      ),
    ).toBe('__Secure-better-auth.session_token=signed-token')
  })

  it('extracts session cookies from combined Set-Cookie headers', () => {
    expect(
      getSessionCookieFromSetCookieHeader(
        'other=value; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, better-auth.session_token=signed-token; Path=/; HttpOnly',
      ),
    ).toBe('better-auth.session_token=signed-token')
  })

  it('ignores unrelated cookies', () => {
    expect(
      getSessionCookieFromSetCookieHeader([
        'better-auth.electron=code; Path=/',
        'other=value; Path=/',
      ]),
    ).toBeNull()
  })

  it('handles missing and empty headers', () => {
    expect(getSessionCookieFromSetCookieHeader(null)).toBeNull()
    expect(getSessionCookieFromSetCookieHeader(undefined)).toBeNull()
    expect(getSessionCookieFromSetCookieHeader('')).toBeNull()
  })
})
