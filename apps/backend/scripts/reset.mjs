import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'
import postgres from 'postgres'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../../..')

config({ path: resolve(repoRoot, '.env') })
config({ path: resolve(repoRoot, '.env.local'), override: true })

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/remora'
const resetHost = new URL(databaseUrl).hostname
const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

if (!localHosts.has(resetHost) && process.env.REMORA_ALLOW_NON_LOCAL_DB_RESET !== '1') {
  console.error(
    `Refusing to reset non-local database host "${resetHost}". Set REMORA_ALLOW_NON_LOCAL_DB_RESET=1 to override.`,
  )
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1 })

try {
  console.log('Resetting database schema...')

  await sql.unsafe('drop schema if exists drizzle cascade')
  await sql.unsafe('drop schema if exists public cascade')
  await sql.unsafe('create schema public')
  await sql.unsafe('grant all on schema public to public')

  console.log('Database schema reset.')
} finally {
  await sql.end({ timeout: 5 })
}
