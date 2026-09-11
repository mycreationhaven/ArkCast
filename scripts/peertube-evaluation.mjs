import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function parseEnv(text) {
  const values = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) throw new Error(`Invalid environment line: ${rawLine}`)
    values[line.slice(0, separator)] = line.slice(separator + 1)
  }
  return values
}

export function validateEvaluationEnv(env) {
  const errors = []
  const required = [
    'PEERTUBE_IMAGE', 'PEERTUBE_EXPECTED_VERSION', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
    'REDIS_PASSWORD', 'PEERTUBE_DB_PASSWORD', 'PEERTUBE_REDIS_AUTH', 'PEERTUBE_SECRET'
  ]
  for (const key of required) {
    if (!env[key]) errors.push(`${key} is required`)
    if (/REPLACE_|placeholder/i.test(env[key] || '')) errors.push(`${key} still contains a placeholder`)
  }
  if (!/^chocobozzz\/peertube@sha256:[a-f0-9]{64}$/.test(env.PEERTUBE_IMAGE || '')) {
    errors.push('PEERTUBE_IMAGE must be the official repository pinned by sha256 digest')
  }
  if (env.PEERTUBE_EXPECTED_VERSION !== '8.2.4') errors.push('PEERTUBE_EXPECTED_VERSION must be 8.2.4 for this evaluation')
  if ((env.POSTGRES_PASSWORD || '').length < 32) errors.push('POSTGRES_PASSWORD must be at least 32 characters')
  if ((env.REDIS_PASSWORD || '').length < 32) errors.push('REDIS_PASSWORD must be at least 32 characters')
  if ((env.PEERTUBE_SECRET || '').length < 64) errors.push('PEERTUBE_SECRET must be at least 64 characters')
  if (env.PEERTUBE_DB_PASSWORD !== env.POSTGRES_PASSWORD) errors.push('PEERTUBE_DB_PASSWORD must equal POSTGRES_PASSWORD')
  if (env.PEERTUBE_REDIS_AUTH !== env.REDIS_PASSWORD) errors.push('PEERTUBE_REDIS_AUTH must equal REDIS_PASSWORD')
  return errors
}

export async function verifyPeerTube(baseUrl, expectedVersion, fetchImpl = fetch) {
  const origin = new URL(baseUrl)
  if (!['http:', 'https:'].includes(origin.protocol)) throw new TypeError('PeerTube origin must use HTTP or HTTPS')
  const response = await fetchImpl(new URL('/api/v1/config', origin), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000)
  })
  if (!response.ok) throw new Error(`PeerTube health request failed with HTTP ${response.status}`)
  const config = await response.json()
  if (config.serverVersion !== expectedVersion) {
    throw new Error(`Expected PeerTube ${expectedVersion}, received ${config.serverVersion || 'unknown'}`)
  }
  return { serverVersion: config.serverVersion, signupAllowed: config.signup?.allowed === true }
}

async function main() {
  const [action, envPath = 'deploy/peertube-evaluation/.env'] = process.argv.slice(2)
  const env = parseEnv(await readFile(envPath, 'utf8'))
  if (action === 'preflight') {
    const errors = validateEvaluationEnv(env)
    if (errors.length) throw new Error(errors.join('\n'))
    console.log('PeerTube evaluation environment passed preflight checks.')
    return
  }
  if (action === 'verify') {
    const result = await verifyPeerTube(`http://127.0.0.1:${env.PEERTUBE_HOST_PORT || '9000'}`, env.PEERTUBE_EXPECTED_VERSION)
    if (result.signupAllowed) throw new Error('Public signup must be disabled before the evaluation can continue')
    console.log(`PeerTube ${result.serverVersion} is healthy and public signup is closed.`)
    return
  }
  throw new Error('Usage: node scripts/peertube-evaluation.mjs <preflight|verify> [env-path]')
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main().catch(error => { console.error(error.message); process.exitCode = 1 })
