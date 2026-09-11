import assert from 'node:assert/strict'
import test from 'node:test'
import { parseEnv, validateEvaluationEnv, verifyPeerTube } from '../peertube-evaluation.mjs'

const digest = 'a'.repeat(64)
const password = 'p'.repeat(32)
const redis = 'r'.repeat(32)
const secret = 's'.repeat(64)

test('evaluation environment requires pinned image and matching secrets', () => {
  const env = parseEnv(`
PEERTUBE_IMAGE=chocobozzz/peertube@sha256:${digest}
PEERTUBE_EXPECTED_VERSION=8.2.4
POSTGRES_USER=arkcast
POSTGRES_PASSWORD=${password}
REDIS_PASSWORD=${redis}
PEERTUBE_DB_PASSWORD=${password}
PEERTUBE_REDIS_AUTH=${redis}
PEERTUBE_SECRET=${secret}
`)
  assert.deepEqual(validateEvaluationEnv(env), [])
})

test('evaluation environment rejects moving image tags and placeholders', () => {
  const errors = validateEvaluationEnv({
    PEERTUBE_IMAGE: 'chocobozzz/peertube:production',
    PEERTUBE_EXPECTED_VERSION: '8.2.4',
    POSTGRES_USER: 'arkcast', POSTGRES_PASSWORD: 'REPLACE_ME',
    REDIS_PASSWORD: 'REPLACE_ME', PEERTUBE_DB_PASSWORD: 'REPLACE_ME',
    PEERTUBE_REDIS_AUTH: 'REPLACE_ME', PEERTUBE_SECRET: 'REPLACE_ME'
  })
  assert.equal(errors.some(error => error.includes('sha256 digest')), true)
  assert.equal(errors.some(error => error.includes('placeholder')), true)
})

test('verification requires the exact evaluated PeerTube version', async () => {
  await assert.rejects(() => verifyPeerTube('http://127.0.0.1:9000', '8.2.4', async () => ({
    ok: true, json: async () => ({ serverVersion: '8.3.0' })
  })), /Expected PeerTube 8.2.4/)
})
