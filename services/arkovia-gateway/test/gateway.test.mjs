import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { canonicalizeProof, encodeOnChainProof, preparePublicationProof } from '../src/proof.mjs'
import { createGatewayServer, loadConfig, probeNode } from '../src/server.mjs'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)

test('publication proof has deterministic canonical order', () => {
  const proof = preparePublicationProof({
    videoId: 'video-1', channelId: 'channel-1', metadataSha256: hashB,
    mediaSha256: hashA, license: 'CC-BY-4.0'
  })
  assert.equal(canonicalizeProof(proof),
    `{"schema":"arkcast.video-proof.v1","channelId":"channel-1","videoId":"video-1","mediaSha256":"${hashA}","metadataSha256":"${hashB}","license":"CC-BY-4.0"}`)
})

test('publication proof rejects malformed hashes', () => {
  assert.throws(() => preparePublicationProof({
    channelId: 'channel-1', videoId: 'video-1',
    mediaSha256: 'not-a-hash', metadataSha256: hashB
  }), /Invalid mediaSha256/)
})

test('on-chain proof is permanent and fits the 160-byte Arkovia message limit', () => {
  const proof = preparePublicationProof({
    channelId: 'channel-1', videoId: 'video-1',
    mediaSha256: hashA, metadataSha256: hashB,
    parentProofHash: 'c'.repeat(64)
  })
  const encoded = encodeOnChainProof(proof)
  assert.equal(encoded.messageIsPrunable, false)
  assert.equal(encoded.messageIsText, false)
  assert.equal(encoded.bytes, 104)
  assert.equal(Buffer.from(encoded.value, 'hex').subarray(0, 4).toString('ascii'), 'AKVP')
})

test('node probe exposes only selected non-sensitive status fields', async () => {
  const result = await probeNode('https://node.example', '/nxt?requestType=getBlockchainStatus', 50, async () => ({
    ok: true,
    json: async () => ({ numberOfBlocks: 42, isDownloading: false, isScanning: false, secret: 'ignored' })
  }))
  assert.equal(result.healthy, true)
  assert.equal(result.height, 42)
  assert.equal('secret' in result, false)
})

test('gateway prepares a proof without copying signing material', async t => {
  const config = loadConfig({
    ARKOVIA_NODE_URLS: 'https://node.example',
    ARKCAST_GATEWAY_HOST: '127.0.0.1',
    ARKCAST_GATEWAY_PORT: '0'
  })
  const server = createGatewayServer(config)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const address = server.address()
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/proofs/prepare`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: 'channel-1', videoId: 'video-1',
      mediaSha256: hashA, metadataSha256: hashB,
      seedPhrase: 'must never be echoed'
    })
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal('seedPhrase' in body.proof, false)
  assert.equal(body.canonicalPayload.includes('must never be echoed'), false)
})
