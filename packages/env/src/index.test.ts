import { describe, expect, it } from 'vitest'

import { parseApiEnv, parseAuthEnv } from './index.ts'

const defaultClientOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'app.remora.desktop:/',
]

const authSecret = 'replace-with-at-least-32-random-characters'

describe('client origins', () => {
  it('defaults API CORS and auth trusted origins to web and desktop clients', () => {
    expect(parseApiEnv({}).API_CORS_ORIGINS).toEqual(defaultClientOrigins)
    expect(
      parseAuthEnv({ BETTER_AUTH_SECRET: authSecret }).CLIENT_TRUSTED_ORIGINS,
    ).toEqual(defaultClientOrigins)
  })

  it('adds explicit CSV origins to the defaults', () => {
    expect(
      parseApiEnv({
        API_CORS_ORIGINS:
          'http://localhost:5173, https://staging.remora.example',
      }).API_CORS_ORIGINS,
    ).toEqual([
      ...defaultClientOrigins,
      'http://localhost:5173',
      'https://staging.remora.example',
    ])

    expect(
      parseAuthEnv({
        BETTER_AUTH_SECRET: authSecret,
        CLIENT_TRUSTED_ORIGINS: 'https://staging.remora.example',
      }).CLIENT_TRUSTED_ORIGINS,
    ).toEqual([...defaultClientOrigins, 'https://staging.remora.example'])
  })

  it('dedupes repeated default and CSV origins', () => {
    expect(
      parseApiEnv({
        API_CORS_ORIGINS:
          [
            'http://localhost:3000',
            'http://localhost:3000',
            'https://staging.remora.example',
            'https://staging.remora.example',
          ].join(','),
      }).API_CORS_ORIGINS,
    ).toEqual([...defaultClientOrigins, 'https://staging.remora.example'])
  })
})
