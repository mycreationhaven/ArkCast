import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'

const dockerfileUrl = new URL('../../services/arkovia-gateway/Dockerfile', import.meta.url)
const composeUrl = new URL('../../deploy/arkovia-gateway/compose.yaml', import.meta.url)

test('gateway image uses a pinned Node 22 runtime and unprivileged user', async () => {
  const dockerfile = await readFile(dockerfileUrl, 'utf8')
  assert.match(dockerfile, /node:22\.19\.0-alpine3\.22/)
  assert.match(dockerfile, /^USER node$/m)
  assert.match(dockerfile, /^HEALTHCHECK /m)
})

test('gateway deployment remains local and reaches the local ARKOS node', async () => {
  const compose = await readFile(composeUrl, 'utf8')
  assert.match(compose, /network_mode: host/)
  assert.match(compose, /ARKCAST_GATEWAY_HOST: 127\.0\.0\.1/)
  assert.match(compose, /ARKOVIA_NODE_URLS: http:\/\/127\.0\.0\.1:4876/)
  assert.doesNotMatch(compose, /^\s*ports:/m)
})

test('gateway deployment applies container hardening and contains no wallet material', async () => {
  const compose = await readFile(composeUrl, 'utf8')
  assert.match(compose, /read_only: true/)
  assert.match(compose, /cap_drop:\s*\n\s*- ALL/)
  assert.match(compose, /no-new-privileges:true/)
  assert.doesNotMatch(compose, /secretPhrase|privateKey|passphrase|seedPhrase/)
})
